// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { chai, describe, it, vi } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType } from '../events/eventTypeDecorator.js';
import { constraint } from '../events/constraints/constraint.js';
import type { IConstraint } from '../events/constraints/IConstraint.js';
import type { IConstraintBuilder } from '../events/constraints/IConstraintBuilder.js';
import { EventScenario, UnsupportedEventSequenceOperation } from './index.js';
import { InProcessConstraints } from './InProcessConstraints.js';

chai.should();
class OracleDomainText {
    @field(String) key: string;
    constructor(key: string) { this.key = key; }
}
eventType('OracleDomainText')(OracleDomainText);
class OracleDomainShared {
    @field(String) key: string;
    constructor(key: string) { this.key = key; }
}
eventType('OracleDomainShared')(OracleDomainShared);
class OracleDomainFlag {
    @field(Boolean) key: boolean;
    constructor(key: boolean) { this.key = key; }
}
eventType('OracleDomainFlag')(OracleDomainFlag);
class TextKey implements IConstraint {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(OracleDomainText, event => event.key).on(OracleDomainShared, event => event.key)
            .withMessage('Taken: {PropertyValue}'));
    }
}
constraint('OracleDomainKey')(TextKey);
class ScalarKey implements IConstraint {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(OracleDomainText, event => event.key).on(OracleDomainShared, event => event.key)
            .on(OracleDomainFlag, event => event.key).withMessage('Taken: {PropertyValue}'));
    }
}
constraint('OracleDomainKey')(ScalarKey);

type Input = { source: string; type: 'string' | 'shared' | 'boolean'; value: string | boolean;
    sourceType?: string; streamType?: string; streamId?: string };
type Routing = { sourceType?: string; streamType?: string; streamId?: string };
type History = { sequence: string; source: string; sourceType: string; streamType: string; streamId: string;
    type: string; content: { key: string | boolean }; hash: string };
type Outcome = { success: boolean; sequences: string[]; violations: Array<{ id: string; message: string; details: Record<string, string> }>;
    wireViolations: Array<{ EventTypeId: string; SequenceNumber: string; ConstraintType: number;
        ConstraintName: string; Message: string; Details: Record<string, string> }>;
    errors: string[]; history: History[]; next: string };
type Fixture = { isolatedConstraintOperations: Array<{ mode: 'single' | 'batch'; events: Input[]; options?: Routing }>;
    expected: { outcomes: Outcome[] } };
const load = (name: string): Fixture => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Fixture;
const event = (entry: Input) => entry.type === 'string' ? new OracleDomainText(entry.value as string) :
    entry.type === 'shared' ? new OracleDomainShared(entry.value as string) : new OracleDomainFlag(entry.value as boolean);
const historyOf = (scenario: EventScenario): History[] => scenario.appendedEvents.map(entry => ({
    sequence: entry.context.sequenceNumber.toString(), source: entry.context.eventSourceId,
    sourceType: entry.context.eventSourceType, streamType: entry.context.eventStreamType, streamId: entry.context.eventStreamId,
    type: entry.eventType.id.value, content: entry.content as { key: string | boolean }, hash: entry.context.hash
}));

describe('fixture-backed unique scalar values', () => {
    for (const name of ['constraints-isolation', 'constraints-key-domain']) {
        it(`matches the packaged kernel ${name} after every operation`, async () => {
            const fixture = load(name);
            const scenario = new EventScenario({ artifacts: {
                eventTypes: [OracleDomainText, OracleDomainShared, OracleDomainFlag],
                constraints: [name === 'constraints-isolation' ? TextKey : ScalarKey]
            } });
            const notifications = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
            const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
            let count = 0;
            try {
                for (const [index, operation] of fixture.isolatedConstraintOperations.entries()) {
                    const expected = fixture.expected.outcomes[index];
                    const before = historyOf(scenario);
                    const resultCount = scenario.results.length;
                    const nextNotification = notifications.next();
                    const results = operation.mode === 'single'
                        ? [await scenario.append(operation.events[0].source, event(operation.events[0]))]
                        : await scenario.appendMany(operation.events.map(entry => ({ eventSourceId: entry.source, event: event(entry),
                            eventSourceType: entry.sourceType ?? operation.options?.sourceType,
                            eventStreamType: entry.streamType ?? operation.options?.streamType,
                            eventStreamId: entry.streamId ?? operation.options?.streamId })));
                    const notification = (await nextNotification).value!;
                    const raw = validate.mock.results.at(-1)?.value as ReturnType<InProcessConstraints['validate']>;
                    raw.map(({ SequenceNumber, ...violation }) => ({ ...violation, SequenceNumber: SequenceNumber.toString() }))
                        .should.deep.equal(expected.wireViolations);
                    notification.length.should.equal(operation.events.length);
                    notification.every(item => item.result.isSuccess === expected.success).should.be.true;
                    count += operation.events.length;
                    scenario.results.length.should.equal(count);
                    results.length.should.equal(operation.events.length);
                    for (const [position, result] of results.entries()) {
                        result.isSuccess.should.equal(expected.success);
                        result.sequenceNumber.value.toString().should.equal(expected.success ? expected.sequences[position] : '0');
                        result.constraintViolations.map(item => ({ id: item.constraintId, message: item.message, details: item.details }))
                            .should.deep.equal(expected.violations);
                        result.errors.map(item => item.message).should.deep.equal(expected.errors);
                    }
                    if (!expected.success) {
                        historyOf(scenario).should.deep.equal(before);
                        scenario.results.length.should.equal(resultCount + operation.events.length);
                    }
                    historyOf(scenario).should.deep.equal(expected.history);
                    (await scenario.eventSequence.getNextSequenceNumber()).value.toString().should.equal(expected.next);
                }
            } finally {
                validate.mockRestore();
                await notifications.return?.();
            }
        });
    }

    it('rejects conversions and strings outside the captured domain without changing state', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: [OracleDomainText, OracleDomainShared, OracleDomainFlag], constraints: [ScalarKey] } });
        (await scenario.append('A', new OracleDomainText('0'))).isSuccess.should.be.true;
        const before = historyOf(scenario);
        const results = scenario.results;
        const unsupportedValues: unknown[] = [1, 0, 1.5, null, undefined, [], {}, new Date(), '!', '#', '?', 'É', 'e\u0301', '"', '\\', '\n'];
        for (const value of unsupportedValues) {
            const bad = new OracleDomainText('valid');
            Object.assign(bad, { key: value });
            await scenario.append('B', bad).then(() => { throw new Error('Unsupported value accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include('Use a kernel-backed test.');
            });
            historyOf(scenario).should.deep.equal(before);
            scenario.results.should.deep.equal(results);
            (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(1n);
        }
        const wrong = new OracleDomainFlag(true);
        Object.assign(wrong, { key: 'true' });
        await scenario.appendMany([{ eventSourceId: 'C', event: new OracleDomainText('new') },
            { eventSourceId: 'D', event: wrong }]).then(() => { throw new Error('Mismatched batch accepted'); }, error => {
            (error instanceof UnsupportedEventSequenceOperation).should.be.true;
            (error as Error).message.should.include('Use a kernel-backed test.');
        });
        historyOf(scenario).should.deep.equal(before);
        scenario.results.should.deep.equal(results);
    });
});
