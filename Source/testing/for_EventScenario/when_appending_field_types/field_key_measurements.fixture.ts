// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import type { Constructor } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi, type Assertion } from 'vitest';
import type { AppendResult } from '../../../eventSequences/AppendResult.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';

chai.should();
const should = (value: unknown): Assertion => (value as { should: Assertion }).should;
type KeyEvent = { key: unknown };
type Types = { text: Constructor<KeyEvent>; decimal: Constructor<KeyEvent>; float: Constructor<KeyEvent> };
type Operation = { mode: string; events: Array<{ source: string; content: string }> };
type History = { source: string; sequence: string; content: Record<string, unknown>; hash: string | undefined };
type WireViolation = { ConstraintName: string; Message: string; Details: Record<string, string> };
type Outcome = { success: boolean; sequences: string[]; wireViolations: WireViolation[]; history: History[]; next: string };
const fixture = JSON.parse(readFileSync(new URL('../../fixtures/constraints-field-key-measurements.json', import.meta.url), 'utf8')) as {
    fieldSchemas: Record<string, JsonSchema>;
    fieldConstraintCases: Array<{ eventType: string; localSteps: number; operations: Operation[] }>;
    expected: Array<{ steps: Outcome[] }>;
};

function definition(type: Constructor<KeyEvent>, mode = 'plain', name = 'OracleFieldKey'): Constructor {
    class Definition {
        define(builder: IConstraintBuilder) {
            if (mode === 'scoped') builder.perEventSourceType();
            builder.unique(key => {
                key.on(type, event => event.key);
                if (mode === 'ignoreCasing') key.ignoreCasing();
                if (mode === 'removable') key.removedWith(type);
            });
        }
    }
    constraint(name)(Definition);
    return Definition;
}

function scenarioFor(type: Constructor<KeyEvent>, constraints = [definition(type)]): EventScenario {
    return new EventScenario({ artifacts: { eventTypes: [type], constraints } });
}

function eventFor(type: Constructor<KeyEvent>, content: string): KeyEvent {
    return Object.assign(new type(), JSON.parse(content));
}

function historyOf(scenario: EventScenario): History[] {
    return scenario.appendedEvents.map(event => ({ source: event.context.eventSourceId,
        sequence: event.context.sequenceNumber.toString(), content: event.content, hash: event.context.hash }));
}

async function append(scenario: EventScenario, type: Constructor<KeyEvent>, operation: Operation): Promise<AppendResult[]> {
    const events = operation.events.map(entry => ({ eventSourceId: entry.source, event: eventFor(type, entry.content) }));
    return operation.mode === 'single'
        ? [await scenario.append(events[0].eventSourceId, events[0].event)]
        : scenario.appendMany(events);
}

function replay(type: Constructor<KeyEvent>, index: number): void {
    describe(`when replaying the measured ${getEventTypeMetadata(type)!.eventType.id.value} keys`, () => {
        it('should match collision details, sequences, hashes and rollback through the production serializer', async () => {
            const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
            const scenario = scenarioFor(type);
            const test = fixture.fieldConstraintCases[index];
            should(test.localSteps).greaterThan(0);
            for (const [step, operation] of test.operations.slice(0, test.localSteps).entries()) {
                const results = await append(scenario, type, operation);
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
            validate.mockRestore();
        });
    });
}

export function fieldKeyMeasurements(types: Types): void {
    for (const type of Object.values(types)) {
        const metadata = getEventTypeMetadata(type)!;
        metadata.schema.properties!.key = fixture.fieldSchemas[metadata.eventType.id.value];
    }
    // Replay complete supported prefixes; later numeric and emoji vectors remain kernel-only measurements.
    replay(types.text, 0);
    replay(types.decimal, 1);
    replay(types.float, 2);

    rejectUnmeasured(types);
    rejectShapes(types);
}

function rejectUnmeasured(types: Types): void {
    for (const [type, values] of [
        [types.text, ['😀', 'λ', '\u0002']],
        [types.decimal, [1e-7, 1e21, 1.5]],
        [types.float, [1.23456789, 1e-7, 1e21, 0.000001, 1.5]]
    ] as const) {
        for (const value of values) {
            describe(`when the ${type.name} key is unproven ${JSON.stringify(value)}`, () => {
                let scenario: EventScenario;
                beforeEach(() => { scenario = scenarioFor(type); });
                for (const mode of ['single', 'batch']) {
                    it(`should keep prior history, results and the next sequence after a rejected ${mode} append`, async () => {
                        const good = Object.assign(new type(), { key: type === types.text ? 'safe' : 0.1 });
                        await scenario.append('A', good);
                        const history = historyOf(scenario);
                        const results = [...scenario.results];
                        const invalid = Object.assign(new type(), { key: value });
                        const pending = mode === 'single' ? scenario.append('B', invalid)
                            : scenario.appendMany([{ eventSourceId: 'B', event: good }, { eventSourceId: 'C', event: invalid }]);
                        const error = await pending.then(() => undefined, error => error);
                        should(error).instanceOf(UnsupportedEventSequenceOperation);
                        should(historyOf(scenario)).deep.equal(history);
                        should(scenario.results).deep.equal(results);
                        should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(1n);
                    });
                }
                it('should reject atomically and leave setup results, history and the next sequence unchanged', async () => {
                    const good = Object.assign(new type(), { key: type === types.text ? 'safe' : 0.1 });
                    const invalid = Object.assign(new type(), { key: value });
                    const error = await scenario.given.forEventSource('A').events(good, invalid).then(() => undefined, error => error);
                    should(error).instanceOf(UnsupportedEventSequenceOperation);
                    should(scenario.appendedEvents).have.lengthOf(0);
                    should(scenario.results).have.lengthOf(0);
                    should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(0n);
                    should((await scenario.append('A', good)).isSuccess).equal(true);
                    should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(1n);
                });
            });
        }
    }

}

function rejectShapes(types: Types): void {
    for (const mode of ['scoped', 'removable', 'ignoreCasing', 'overlapping']) {
        for (const type of Object.values(types)) {
            it(`should keep new ${type.name} keys rejected for ${mode} definitions`, async () => {
                const constraints = mode === 'overlapping'
                    ? [definition(type), definition(type, 'plain', 'OtherKey')]
                    : [definition(type, mode)];
                const value = type === types.text ? '東京' : 0.1;
                const error = await Promise.resolve().then(() => scenarioFor(type, constraints))
                    .then(scenario => scenario.append('A', Object.assign(new type(), { key: value }))).then(() => undefined, error => error);
                should(error).instanceOf(UnsupportedEventSequenceOperation);
                should(String(error)).include('artifacts.constraints');
            });
        }
    }
}
