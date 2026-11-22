// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import type { Constructor } from '@cratis/fundamentals';
import { chai, describe, it, vi, type Assertion } from 'vitest';
import type { AppendResult } from '../../../eventSequences/AppendResult.js';
import { constraint } from '../../../events/constraints/constraint.js';
import { ConstraintBuilder } from '../../../events/constraints/ConstraintBuilder.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';
import { claimOf } from '../../ConstraintKey.js';

chai.should();
const should = (value: unknown): Assertion => (value as { should: Assertion }).should;
type TextEvent = { key: string };
type PairEvent = TextEvent & { other: string };
type Types = { text: Constructor<TextEvent>; pair: Constructor<PairEvent>; sibling: Constructor<TextEvent> };
type Shape = 'plain' | 'scoped' | 'ignoreCasing' | 'composite' | 'removable' | 'overlapping' | 'shared' | 'multiple';
type Operation = { mode: string; events: Array<{ source: string; content: string }> };
type History = { source: string; sequence: string; content: Record<string, unknown>; hash: string | undefined };
type WireViolation = { ConstraintName: string; Message: string; Details: Record<string, string> };
type Outcome = { success: boolean; sequences: string[]; wireViolations: WireViolation[]; history: History[]; next: string };
type Observation = { input: string; utf8Sha256: string; scalars: number[] };
const fixture = JSON.parse(readFileSync(new URL('../../fixtures/constraints-case-sensitive-unicode.json', import.meta.url), 'utf8')) as {
    fieldConstraintCases: Array<{ name: string; localSteps: number; operations: Operation[] }>;
    expected: Array<{ steps: Outcome[]; textObservations: Observation[] }>;
};
const candidates = ['Λ', 'λ', 'Ж', 'ж', '中'];
// Exact neighbours, never ranges. Ω also remains outside the measured payload allowlist.
const unmeasured = ['Κ', 'μ', 'З', 'з', '丮', 'Ω', '\u{1f601}', '\u{10001}', '\u0002', '\ud83d', '\ude00', '\ude00\ud83d'];

function define(builder: IConstraintBuilder, types: Types, shape: Shape, secondary = false): void {
    if (shape === 'scoped') builder.perEventSourceType();
    builder.unique(key => {
        if (shape === 'composite') key.on(types.pair, event => event.key, event => event.other);
        else if (shape === 'overlapping' && secondary) key.on(types.pair, event => event.other);
        else if (shape === 'overlapping') key.on(types.pair, event => event.key);
        else key.on(types.text, event => event.key);
        if (shape === 'shared') key.on(types.sibling, event => event.key);
        if (shape === 'ignoreCasing') key.ignoreCasing();
        if (shape === 'removable') key.removedWith(types.sibling);
    });
}

function definition(types: Types, shape: Shape, name = 'OracleFieldKey'): Constructor {
    class Definition { define(builder: IConstraintBuilder) { define(builder, types, shape, name === 'OtherKey'); } }
    constraint(name)(Definition);
    return Definition;
}

function scenarioFor(types: Types, shape: Shape = 'plain'): EventScenario {
    const constraints = [definition(types, shape)];
    if (shape === 'overlapping') constraints.push(definition(types, shape, 'OtherKey'));
    if (shape === 'multiple') constraints.push(definition({ ...types, text: types.sibling }, 'plain', 'OtherKey'));
    return new EventScenario({ artifacts: { eventTypes: Object.values(types), constraints } });
}

function eventFor(types: Types, key: string, shape: Shape = 'plain'): TextEvent {
    if (shape === 'composite') return Object.assign(new types.pair(), { key, other: 'x' });
    if (shape === 'overlapping') return Object.assign(new types.pair(), { key, other: key });
    return Object.assign(new types.text(), { key });
}

function historyOf(scenario: EventScenario): History[] {
    return scenario.appendedEvents.map(event => ({ source: event.context.eventSourceId,
        sequence: event.context.sequenceNumber.toString(), content: event.content, hash: event.context.hash }));
}

async function append(scenario: EventScenario, types: Types, operation: Operation): Promise<AppendResult[]> {
    const events = operation.events.map(entry => ({ eventSourceId: entry.source, event: Object.assign(new types.text(), JSON.parse(entry.content)) }));
    return operation.mode === 'single' ? [await scenario.append(events[0].eventSourceId, events[0].event)] : scenario.appendMany(events);
}

function replay(types: Types, index: number): void {
    const test = fixture.fieldConstraintCases[index];
    it(`should replay every ${test.name} operation with content, hashes, raw and public violations and rollback`, async () => {
        const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
        try {
            const scenario = scenarioFor(types);
            should(test.localSteps).equal(test.operations.length);
            should(fixture.expected[index].steps).have.lengthOf(test.operations.length);
            for (const [step, operation] of test.operations.entries()) {
                const results = await append(scenario, types, operation);
                const expected = fixture.expected[index].steps[step];
                should(results.every(result => result.isSuccess === expected.success)).equal(true);
                should(results.map(result => result.sequenceNumber.value.toString())).deep.equal(
                    expected.success ? expected.sequences : results.map(() => '0'));
                const raw = validate.mock.results.at(-1)!.value as ReturnType<InProcessConstraints['validate']>;
                should(raw.map(violation => ({ ...violation, SequenceNumber: violation.SequenceNumber.toString() }))).deep.equal(expected.wireViolations);
                for (const result of results) {
                    should(result.constraintViolations.map(item => ({ id: item.constraintId, message: item.message, details: item.details })))
                        .deep.equal(expected.wireViolations.map(item => ({ id: item.ConstraintName, message: item.Message, details: item.Details })));
                }
                should(historyOf(scenario)).deep.equal(expected.history);
                should((await scenario.eventSequence.getNextSequenceNumber()).value.toString()).equal(expected.next);
            }
        } finally { validate.mockRestore(); }
    });
    it(`should preserve each ${test.name} input's exact scalar sequence and kernel UTF-8 key hash`, async () => {
        const observations = fixture.expected[index].textObservations;
        should(observations.length).greaterThan(0);
        const builder = new ConstraintBuilder('OracleFieldKey');
        define(builder, types, 'plain');
        for (const observation of observations) {
            const scenario = scenarioFor(types);
            await scenario.append('A', eventFor(types, observation.input));
            const event = scenario.appendedEvents[0];
            should(Array.from(event.content.key as string, scalar => scalar.codePointAt(0)!)).deep.equal(observation.scalars);
            should(claimOf('OracleFieldKey', builder.capture, event, {
                isolated: true, schema: { type: 'object', properties: { key: { type: 'string' } } }
            })!.key).equal(observation.utf8Sha256);
        }
    });
}

async function rejected(pending: Promise<unknown>): Promise<void> {
    const error: unknown = await pending.then(() => undefined, error => error);
    should(error).instanceOf(UnsupportedEventSequenceOperation);
    should(String(error)).match(/append(?:Many)?\.content|artifacts\.constraints/);
}

function rejectText(types: Types, value: string, shape: Shape = 'plain'): void {
    const good = (key: string): TextEvent => eventFor(types, key, shape);
    for (const mode of ['single', 'batch']) {
        it(`should reject ${JSON.stringify(value)} atomically in a ${shape} ${mode} append without leaking claims`, async () => {
            const scenario = scenarioFor(types, shape);
            await scenario.append('A', good('safe'));
            const history = historyOf(scenario);
            const results = [...scenario.results];
            await rejected(mode === 'single' ? scenario.append('C', good(value))
                : scenario.appendMany([{ eventSourceId: 'B', event: good('fresh') }, { eventSourceId: 'C', event: good(value) }]));
            should(historyOf(scenario)).deep.equal(history);
            should(scenario.results).deep.equal(results);
            should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(1n);
            should((await scenario.append('B', good('fresh'))).isSuccess).equal(true);
            should((await scenario.append('C', good('safe'))).constraintViolations.length).greaterThan(0);
        });
    }
    it(`should reject ${JSON.stringify(value)} atomically in ${shape} given setup and leave its valid key claimable`, async () => {
        const scenario = scenarioFor(types, shape);
        await rejected(scenario.given.forEventSource('A').events(good('safe'), good(value)));
        should(scenario.appendedEvents).have.lengthOf(0);
        should(scenario.results).have.lengthOf(0);
        should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(0n);
        should((await scenario.append('B', good('safe'))).isSuccess).equal(true);
    });
}

function payloads(types: Types): void {
    for (const [index, value] of candidates.entries()) {
        it(`should round-trip unconstrained ${value} payload content and its oracle-measured hash`, async () => {
            const scenario = new EventScenario({ artifacts: { eventTypes: [types.text] }, constraints: 'disabled' });
            await scenario.append('A', eventFor(types, value));
            should(historyOf(scenario)).deep.equal(fixture.expected[index].steps[0].history);
        });
    }
    for (const value of unmeasured) {
        it(`should still reject unconstrained unmeasured ${JSON.stringify(value)} payloads`, async () => {
            const scenario = new EventScenario({ artifacts: { eventTypes: [types.text] }, constraints: 'disabled' });
            await rejected(scenario.append('A', eventFor(types, value)));
            should(scenario.appendedEvents).have.lengthOf(0);
            should(scenario.results).have.lengthOf(0);
            should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(0n);
        });
    }
}

export function caseSensitiveUnicode(types: Types): void {
    describe('when replaying case-sensitive Unicode measurements', () => {
        should(fixture.fieldConstraintCases.length).greaterThan(0);
        should(fixture.expected).have.lengthOf(fixture.fieldConstraintCases.length);
        for (const index of fixture.fieldConstraintCases.keys()) replay(types, index);
    });
    describe('when keys contain unmeasured scalars or malformed surrogates', () => {
        for (const value of unmeasured) {
            rejectText(types, value);
            rejectText(types, `Aλ${value}中z`);
        }
    });
    describe('when measured scalars are used outside the isolated case-sensitive single-property shape', () => {
        for (const shape of ['ignoreCasing', 'scoped', 'composite', 'removable', 'overlapping', 'shared', 'multiple'] as const) {
            for (const value of candidates) rejectText(types, value, shape);
        }
    });
    describe('when plain-string payloads use the shared measured alphabet', () => payloads(types));
}
