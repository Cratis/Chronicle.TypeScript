// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Constructor } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi, type Assertion } from 'vitest';
import type { AppendResult } from '../../../eventSequences/AppendResult.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';
import { measuredLowerInvariant } from '../../MeasuredCaseFolding.js';

chai.should();
const should = (value: unknown): Assertion => (value as { should: Assertion }).should;
type TextEvent = { key: string };
type PairEvent = { key: string; other: string };
type Types = { text: Constructor<TextEvent>; pair: Constructor<PairEvent> };
type Operation = { mode: string; events: Array<{ source: string; content: string }> };
type History = { source: string; sequence: string; content: Record<string, unknown>; hash: string | undefined };
type WireViolation = { ConstraintName: string; Message: string; Details: Record<string, string> };
type Outcome = { success: boolean; sequences: string[]; wireViolations: WireViolation[]; history: History[]; next: string };
type Observation = { input: string; lowered: string; utf8Sha256: string };
const fixture = JSON.parse(readFileSync(new URL('../../fixtures/constraints-ignore-casing-measurements.json', import.meta.url), 'utf8')) as {
    fieldConstraintCases: Array<{ name: string; localSteps: number; operations: Operation[] }>;
    expected: Array<{ steps: Outcome[]; casingObservations: Observation[] }>;
};
const unmeasuredNeighbours = ['\u00c8', '\u00e8', '\u00d8', '\u00de', '\u00e0', '\u0300', '\u0302', '\u0130', '\u0131', '\u03a3', '\u03c3',
    '\u03c2', '\u1e9e', '\u212a', '\u6771', '\u4eac', '\u{10400}', '\u{1f600}', '\ud83d', '\ude00', '\ude00\ud83d', '\u00c9\ud83d', '\u00c9\u6771'];

function definition(type: Constructor, mode: 'ignoreCasing' | 'scoped' | 'removable' | 'composite' | 'overlapping', name = 'OracleFieldKey'): Constructor {
    class Definition {
        define(builder: IConstraintBuilder) {
            if (mode === 'scoped') builder.perEventSourceType();
            builder.unique(key => {
                if (mode === 'composite') key.on(type as Constructor<PairEvent>, event => event.key, event => event.other);
                else key.on(type as Constructor<TextEvent>, event => event.key);
                key.ignoreCasing();
                if (mode === 'removable') key.removedWith(type);
            });
        }
    }
    constraint(name)(Definition);
    return Definition;
}

function scenarioFor(types: Types, mode: Parameters<typeof definition>[1] = 'ignoreCasing'): EventScenario {
    const type = mode === 'composite' ? types.pair : types.text;
    const constraints = mode === 'overlapping' ? [definition(type, 'ignoreCasing'), definition(type, 'ignoreCasing', 'OtherCasedKey')] : [definition(type, mode)];
    return new EventScenario({ artifacts: { eventTypes: [type], constraints } });
}

function textOf(type: Constructor<TextEvent>, content: string): TextEvent {
    return Object.assign(new type(), JSON.parse(content));
}

function historyOf(scenario: EventScenario): History[] {
    return scenario.appendedEvents.map(event => ({ source: event.context.eventSourceId,
        sequence: event.context.sequenceNumber.toString(), content: event.content, hash: event.context.hash }));
}

async function append(scenario: EventScenario, type: Constructor<TextEvent>, operation: Operation): Promise<AppendResult[]> {
    const events = operation.events.map(entry => ({ eventSourceId: entry.source, event: textOf(type, entry.content) }));
    return operation.mode === 'single' ? [await scenario.append(events[0].eventSourceId, events[0].event)] : scenario.appendMany(events);
}

function replay(types: Types, index: number): void {
    const test = fixture.fieldConstraintCases[index];
    it(`should match collision details, sequences, hashes and rollback through the production serializer for ${test.name}`, async () => {
        const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
        const scenario = scenarioFor(types);
        should(test.localSteps).equal(test.operations.length);
        for (const [step, operation] of test.operations.entries()) {
            const results = await append(scenario, types.text, operation);
            const expected = fixture.expected[index].steps[step];
            should(results.every(result => result.isSuccess === expected.success)).equal(true);
            should(results.map(result => result.sequenceNumber.value.toString())).deep.equal(
                expected.success ? expected.sequences : results.map(() => '0'));
            const raw = validate.mock.results.at(-1)!.value as ReturnType<InProcessConstraints['validate']>;
            should(raw.map(violation => ({ ...violation, SequenceNumber: violation.SequenceNumber.toString() }))).deep.equal(expected.wireViolations);
            should(historyOf(scenario)).deep.equal(expected.history);
            should((await scenario.eventSequence.getNextSequenceNumber()).value.toString()).equal(expected.next);
        }
        validate.mockRestore();
    });
}

function observe(index: number): void {
    const test = fixture.fieldConstraintCases[index];
    it(`should map every ${test.name} input to the lowered text and hash the oracle observed from the kernel operation`, () => {
        const observations = fixture.expected[index].casingObservations;
        should(observations.length).greaterThan(0);
        for (const observation of observations) {
            should(measuredLowerInvariant(observation.input)).equal(observation.lowered);
            should(createHash('sha256').update(measuredLowerInvariant(observation.input)).digest('hex')).equal(observation.utf8Sha256);
        }
    });
}

function rejectUnmeasured(types: Types): void {
    for (const value of unmeasuredNeighbours) {
        describe(`when the ignoreCasing key is the unmeasured ${JSON.stringify(value)}`, () => {
            let scenario: EventScenario;
            beforeEach(() => { scenario = scenarioFor(types); });
            const good = (key: string) => Object.assign(new types.text(), { key });
            const invalid = (): TextEvent => Object.assign(new types.text(), { key: value });
            for (const mode of ['single', 'batch']) {
                it(`should keep history, results, the next sequence and claim ownership after a rejected ${mode} append`, async () => {
                    await scenario.append('A', good('\u00c9'));
                    const history = historyOf(scenario);
                    const results = [...scenario.results];
                    const pending = mode === 'single' ? scenario.append('B', invalid())
                        : scenario.appendMany([{ eventSourceId: 'B', event: good('ok') }, { eventSourceId: 'C', event: invalid() }]);
                    should(await pending.then(() => undefined, error => error)).instanceOf(UnsupportedEventSequenceOperation);
                    should(historyOf(scenario)).deep.equal(history);
                    should(scenario.results).deep.equal(results);
                    should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(1n);
                    should((await scenario.append('B', good('ok'))).isSuccess).equal(true);
                    should((await scenario.append('C', good('\u00e9'))).constraintViolations).have.lengthOf(1);
                });
            }
            it('should reject a failing given atomically and leave its valid key claimable', async () => {
                const error = await scenario.given.forEventSource('A').events(good('\u00c9'), invalid()).then(() => undefined, error => error);
                should(error).instanceOf(UnsupportedEventSequenceOperation);
                should(scenario.appendedEvents).have.lengthOf(0);
                should(scenario.results).have.lengthOf(0);
                should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(0n);
                should((await scenario.append('B', good('\u00e9'))).isSuccess).equal(true);
            });
        });
    }
}

function rejectShapes(types: Types): void {
    for (const mode of ['scoped', 'removable', 'composite', 'overlapping'] as const) {
        for (const value of ['\u00c9', '\u00df', '\u00f8', '\u0301']) {
            it(`should keep new ${JSON.stringify(value)} rejected for ${mode} ignoreCasing definitions`, async () => {
                const event = mode === 'composite' ? Object.assign(new types.pair(), { key: value, other: 'x' })
                    : Object.assign(new types.text(), { key: value });
                const error = await Promise.resolve().then(() => scenarioFor(types, mode))
                    .then(scenario => scenario.append('A', event)).then(() => undefined, error => error);
                should(error).instanceOf(UnsupportedEventSequenceOperation);
                should(String(error)).include('artifacts.constraints');
            });
        }
    }
    it('should keep the ASCII counterpart of the scoped and composite shapes passing, so the rejections are about the key', async () => {
        should((await scenarioFor(types, 'scoped').append('A', Object.assign(new types.text(), { key: 'Ab' }))).isSuccess).equal(true);
        should((await scenarioFor(types, 'composite').append('A', Object.assign(new types.pair(), { key: 'Ab', other: 'x' }))).isSuccess).equal(true);
    });
}

export function caseFoldedText(types: Types): void {
    describe('when replaying the measured ignoreCasing keys', () => {
        for (const index of fixture.fieldConstraintCases.keys()) { replay(types, index); observe(index); }
    });
    rejectUnmeasured(types);
    describe('when the measured keys are used in an unmeasured definition shape', () => rejectShapes(types));
}
