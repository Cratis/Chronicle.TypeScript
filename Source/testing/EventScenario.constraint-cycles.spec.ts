// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { chai, describe, it, vi } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType, getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { constraint } from '../events/constraints/constraint.js';
import { compileConstraints } from '../events/constraints/Constraints.js';
import type { IConstraint } from '../events/constraints/IConstraint.js';
import type { IConstraintBuilder } from '../events/constraints/IConstraintBuilder.js';
import { removeConstraint } from '../events/constraints/removeConstraint.js';
import { EventScenario, UnsupportedEventSequenceOperation } from './index.js';
import { InProcessConstraints } from './InProcessConstraints.js';
import { ReactorScenario } from './ReactorScenario.js';
import { reactor } from '../reactors/reactor.js';

chai.should();
class OracleCycleFirst { @field(String) label: string; constructor(label: string) { this.label = label; } }
eventType('OracleCycleFirst')(OracleCycleFirst);
class OracleCycleSibling { @field(String) label: string; constructor(label: string) { this.label = label; } }
eventType('OracleCycleSibling')(OracleCycleSibling);
class OracleCycleRemoved { @field(String) label: string; constructor(label: string) { this.label = label; } }
eventType('OracleCycleRemoved')(OracleCycleRemoved);
removeConstraint('OracleCycle')(OracleCycleRemoved);
class OracleCycleExpired { @field(String) label: string; constructor(label: string) { this.label = label; } }
eventType('OracleCycleExpired')(OracleCycleExpired);
removeConstraint('OracleCycle')(OracleCycleExpired);
class OracleCycleRenewed { @field(String) label: string; constructor(label: string) { this.label = label; } }
eventType('OracleCycleRenewed')(OracleCycleRenewed);
removeConstraint('OracleCycle')(OracleCycleRenewed);
// Same-named uniqueFor declarations merge into one definition covering the whole set.
class CycleFirst implements IConstraint {
    define(builder: IConstraintBuilder) { builder.uniqueFor(OracleCycleFirst, 'Cycle occupied', 'OracleCycle'); }
}
constraint('CycleFirst')(CycleFirst);
class CycleSibling implements IConstraint {
    define(builder: IConstraintBuilder) { builder.uniqueFor(OracleCycleSibling, undefined, 'OracleCycle'); }
}
constraint('CycleSibling')(CycleSibling);
class CycleRenewed implements IConstraint {
    define(builder: IConstraintBuilder) { builder.uniqueFor(OracleCycleRenewed, undefined, 'OracleCycle'); }
}
constraint('CycleRenewed')(CycleRenewed);

const aliases = { first: OracleCycleFirst, sibling: OracleCycleSibling, cycleRemoved: OracleCycleRemoved,
    cycleExpired: OracleCycleExpired, renewed: OracleCycleRenewed };
type Alias = keyof typeof aliases;
type Input = { source: string; type: Alias; value: string };
type History = { sequence: string; source: string; sourceType: string; streamType: string; streamId: string;
    type: string; content: Record<string, string>; hash: string };
type Violation = { EventTypeId: string; SequenceNumber: string; ConstraintType: number; ConstraintName: string;
    Message: string; Details: Record<string, string> };
type Outcome = { success: boolean; sequences: string[]; violations: Array<{ id: string; message: string; details: Record<string, string> }>;
    wireViolations: Violation[]; errors: string[]; history: History[]; next: string };
type Fixture = { eventSchemas: Record<string, { eventTypeId: string; properties: Record<string, string> }>;
    constraintDefinitions: Array<{ kind: string; name: string; eventTypes: string[]; removedWithEventTypeIds: string[]; message: string }>;
    isolatedConstraintOperations: Array<{ mode: 'single' | 'batch'; events: Input[] }>;
    expected: { outcomes: Outcome[] } };
const aliasById = Object.fromEntries(Object.entries(aliases).map(([alias, type]) => [getEventTypeMetadata(type)!.eventType.id.value, alias]));
const makeEvent = ({ type, value }: Input): object => new aliases[type](value);
const historyOf = (scenario: EventScenario): History[] => scenario.appendedEvents.map(entry => ({
    sequence: entry.context.sequenceNumber.toString(), source: entry.context.eventSourceId,
    sourceType: entry.context.eventSourceType, streamType: entry.context.eventStreamType, streamId: entry.context.eventStreamId,
    type: entry.eventType.id.value, content: entry.content as Record<string, string>, hash: entry.context.hash
}));
const unsupported = async (action: () => unknown, operation: string, reason: string) => {
    await Promise.resolve().then(action).then(() => { throw new Error('Expected rejection'); }, error => {
        (error instanceof UnsupportedEventSequenceOperation).should.be.true;
        (error as Error).message.should.include(`UnsupportedEventSequenceOperation: ${operation}:`);
        (error as Error).message.should.include(reason);
        (error as Error).message.should.include('Use a kernel-backed test.');
    });
};
const siblingTypes = [OracleCycleFirst, OracleCycleSibling, OracleCycleRemoved, OracleCycleExpired];
const cycleTypes = [...siblingTypes, OracleCycleRenewed];
const shapeReason = 'This unique event type set and removal combination is not fixture-backed.';

describe('fixture-backed unique event type cycles', () => {
    for (const [name, selected, constraints] of [
        ['constraints-event-type-siblings', siblingTypes, [CycleFirst, CycleSibling]],
        ['constraints-event-type-cycles', cycleTypes, [CycleFirst, CycleSibling, CycleRenewed]]
    ] as const) {
        it(`matches the pinned kernel ${name}: raw and mapped violations, cycles, hashes and rollback`, async () => {
            const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Fixture;
            Object.fromEntries(selected.map(type => {
                const metadata = getEventTypeMetadata(type)!;
                return [aliasById[metadata.eventType.id.value], { eventTypeId: metadata.eventType.id.value,
                    properties: Object.fromEntries(Object.entries(metadata.schema.properties ?? {}).map(([key, property]) => [key, property.type])) }];
            })).should.deep.equal(fixture.eventSchemas);
            const compiled = compileConstraints({ eventTypes: [...selected], constraints: [...constraints] });
            [...compiled].map(([key, capture]) => ({ kind: 'uniqueEventType', name: key,
                eventTypes: capture.uniqueEventType!.eventTypeIds!.map(id => aliasById[id]),
                removedWithEventTypeIds: capture.uniqueEventType!.removedWithEventTypeIds!.map(id => aliasById[id]),
                message: capture.uniqueEventType!.message ?? ''
            })).should.deep.equal(fixture.constraintDefinitions);
            fixture.isolatedConstraintOperations.length.should.be.greaterThan(0);
            fixture.expected.outcomes.length.should.equal(fixture.isolatedConstraintOperations.length);
            fixture.expected.outcomes.some(outcome => !outcome.success).should.be.true;
            const scenario = new EventScenario({ artifacts: { eventTypes: [...selected], constraints: [...constraints] } });
            const notifications = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
            const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
            let count = 0;
            try {
                for (const [index, operation] of fixture.isolatedConstraintOperations.entries()) {
                    const expected = fixture.expected.outcomes[index];
                    const before = historyOf(scenario);
                    const calls = validate.mock.calls.length;
                    const nextNotification = notifications.next();
                    const results = operation.mode === 'single'
                        ? [await scenario.append(operation.events[0].source, makeEvent(operation.events[0]))]
                        : await scenario.appendMany(operation.events.map(entry => ({ eventSourceId: entry.source, event: makeEvent(entry) })));
                    const notification = (await nextNotification).value!;
                    validate.mock.calls.length.should.equal(calls + 1);
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
                    if (!expected.success) historyOf(scenario).should.deep.equal(before);
                    historyOf(scenario).should.deep.equal(expected.history);
                    (await scenario.eventSequence.getNextSequenceNumber()).value.toString().should.equal(expected.next);
                }
            } finally {
                validate.mockRestore();
                await notifications.return?.();
            }
        });
    }

    it('rolls back a release and reclaim in a failing setup call without results or notifications', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: siblingTypes, constraints: [CycleFirst, CycleSibling] } });
        const notifications = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
        try {
            const first = notifications.next();
            await scenario.given.forEventSource('A').events(new OracleCycleFirst('claim'));
            (await first).value!.length.should.equal(1);
            const before = historyOf(scenario);
            await scenario.given.forEventSource('A').events(new OracleCycleRemoved('release'), new OracleCycleFirst('reopen'),
                new OracleCycleSibling('blocked'))
                .then(() => { throw new Error('Invalid setup succeeded'); }, error => {
                    (error as Error).message.should.include('EventScenario given setup failed');
                });
            historyOf(scenario).should.deep.equal(before);
            scenario.results.length.should.equal(0);
            (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(1n);
            const next = notifications.next();
            const blocked = await scenario.append('A', new OracleCycleSibling('still held'));
            blocked.constraintViolations.map(item => item.constraintId).should.deep.equal(['OracleCycle']);
            (await next).value!.map(item => item.event.eventType.id.value).should.deep.equal(['OracleCycleSibling']);
        } finally { await notifications.return?.(); }
    });

    it('delivers only committed claim and release events to a reactor', async () => {
        const calls: string[] = [];
        @reactor('cycle-reactor')
        class CycleReactor {
            oracleCycleFirst(event: OracleCycleFirst) { calls.push(event.label); }
            oracleCycleSibling(event: OracleCycleSibling) { calls.push(event.label); }
            oracleCycleExpired(event: OracleCycleExpired) { calls.push(event.label); }
        }
        const subject = new ReactorScenario(CycleReactor,
            { artifacts: { eventTypes: siblingTypes, constraints: [CycleFirst, CycleSibling] } });
        await subject.when.forEventSource('A').events(new OracleCycleFirst('claim'));
        await subject.when.forEventSource('A').events(new OracleCycleSibling('blocked'))
            .then(() => { throw new Error('Occupied cycle delivered'); }, error => {
                (error as Error).message.should.include('ReactorScenario action append failed');
            });
        calls.should.deep.equal(['claim']);
        subject.results.length.should.equal(1);
        await subject.when.forEventSource('A').events(new OracleCycleExpired('release'), new OracleCycleSibling('reclaim'));
        calls.should.deep.equal(['claim', 'release', 'reclaim']);
        subject.results.length.should.equal(2);
    });

    it('rejects unsupported input in a batch and leaves history and results unchanged', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: siblingTypes, constraints: [CycleFirst, CycleSibling] } });
        (await scenario.append('A', new OracleCycleFirst('claim'))).isSuccess.should.be.true;
        const before = historyOf(scenario);
        const results = scenario.results;
        await unsupported(() => scenario.appendMany([{ eventSourceId: 'A', event: new OracleCycleExpired('release') },
            { eventSourceId: 'B!', event: new OracleCycleFirst('claim') }]), 'appendMany.source (B!)',
        'Only simple source identifiers are fixture-backed.');
        historyOf(scenario).should.deep.equal(before);
        scenario.results.should.deep.equal(results);
        const blocked = await scenario.append('A', new OracleCycleSibling('still held'));
        blocked.isSuccess.should.be.false;
        blocked.constraintViolations.map(item => item.message).should.deep.equal(['Cycle occupied']);
    });

    it('rejects covered and removal type shapes that no fixture installs, at the shape check', async () => {
        await unsupported(() => new EventScenario({ artifacts: {
            eventTypes: [OracleCycleFirst, OracleCycleSibling, OracleCycleRemoved], constraints: [CycleFirst, CycleSibling]
        } }), 'artifacts.constraints (OracleCycle)', shapeReason);
        await unsupported(() => new EventScenario({ artifacts: {
            eventTypes: [OracleCycleFirst, OracleCycleRemoved, OracleCycleRenewed], constraints: [CycleFirst, CycleRenewed]
        } }), 'artifacts.constraints (OracleCycle)', shapeReason);
        await unsupported(() => new EventScenario({ artifacts: {
            eventTypes: [OracleCycleFirst, OracleCycleSibling, OracleCycleRemoved, OracleCycleRenewed],
            constraints: [CycleFirst, CycleSibling, CycleRenewed]
        } }), 'artifacts.constraints (OracleCycle)', shapeReason);
    });

    it('rejects a fixture-shaped cycle installed alongside another definition', async () => {
        class OtherOnce { @field(String) label = 'other'; }
        eventType('OracleCycleOtherOnce')(OtherOnce);
        class OtherOnceConstraint implements IConstraint {
            define(builder: IConstraintBuilder) { builder.uniqueFor(OtherOnce, undefined, 'OracleCycleOther'); }
        }
        constraint('OracleCycleOther')(OtherOnceConstraint);
        await unsupported(() => new EventScenario({ artifacts: {
            eventTypes: [...siblingTypes, OtherOnce], constraints: [CycleFirst, CycleSibling, OtherOnceConstraint]
        } }), 'artifacts.constraints (OracleCycle)', 'Unique event cycles alongside other definitions are not fixture-backed.');
    });

    it('rejects a fieldless event-type remover at the schema check', async () => {
        class FieldlessRemoval {}
        eventType('OracleCycleFieldless')(FieldlessRemoval);
        removeConstraint('OracleCycle')(FieldlessRemoval);
        await unsupported(() => new EventScenario({ artifacts: {
            eventTypes: [OracleCycleFirst, OracleCycleSibling, OracleCycleRemoved, FieldlessRemoval],
            constraints: [CycleFirst, CycleSibling]
        } }), 'artifacts.eventTypes.schema (FieldlessRemoval)', 'Only unclassified string, boolean, numeric, Guid, date and object fields are supported.');
    });
});
