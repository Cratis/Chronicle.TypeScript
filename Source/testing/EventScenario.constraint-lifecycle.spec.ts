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
class OracleDomainText { @field(String) key: string; constructor(key: string) { this.key = key; } }
eventType('OracleDomainText')(OracleDomainText);
class OracleDomainShared { @field(String) key: string; constructor(key: string) { this.key = key; } }
eventType('OracleDomainShared')(OracleDomainShared);
class OracleDomainRemoved { @field(String) label: string; constructor(label: string) { this.label = label; } }
eventType('OracleDomainRemoved')(OracleDomainRemoved);
removeConstraint('OracleLifecycleKey')(OracleDomainRemoved);
class OracleDomainExpired { @field(String) label: string; constructor(label: string) { this.label = label; } }
eventType('OracleDomainExpired')(OracleDomainExpired);
class OracleDomainCleared {}
eventType('OracleDomainCleared')(OracleDomainCleared);
class LifecycleKey implements IConstraint {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(OracleDomainText, event => event.key).on(OracleDomainShared, event => event.key)
            .removedWith(OracleDomainExpired).removedWith(OracleDomainCleared).withMessage('Taken: {PropertyValue}'));
    }
}
constraint('OracleLifecycleKey')(LifecycleKey);
class CoveredRemoval implements IConstraint {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(OracleDomainShared, event => event.key).on(OracleDomainText, event => event.key)
            .removedWith(OracleDomainText).withMessage('Taken: {PropertyValue}'));
    }
}
constraint('OracleCoveredRemoval')(CoveredRemoval);

type Alias = 'string' | 'shared' | 'removed' | 'expired' | 'cleared';
type Input = { source: string; type: Alias; value?: string };
type History = { sequence: string; source: string; sourceType: string; streamType: string; streamId: string;
    type: string; content: Record<string, string>; hash: string };
type Violation = { EventTypeId: string; SequenceNumber: string; ConstraintType: number; ConstraintName: string;
    Message: string; Details: Record<string, string> };
type Outcome = { success: boolean; sequences: string[]; violations: Array<{ id: string; message: string; details: Record<string, string> }>;
    wireViolations: Violation[]; errors: string[]; history: History[]; next: string };
type Fixture = { eventSchemas: Record<string, { eventTypeId: string; properties: Record<string, string> }>;
    constraintDefinitions: Array<{ kind: string; name: string; events: Array<{ type: string; properties: string[] }>;
        ignoreCasing: boolean; removedWithEventTypeIds: string[]; message: string }>;
    isolatedConstraintOperations: Array<{ mode: 'single' | 'batch'; events: Input[] }>;
    expected: { outcomes: Outcome[] } };
const aliases = { string: OracleDomainText, shared: OracleDomainShared, removed: OracleDomainRemoved,
    expired: OracleDomainExpired, cleared: OracleDomainCleared };
const aliasById = Object.fromEntries(Object.entries(aliases).map(([alias, type]) => [getEventTypeMetadata(type)!.eventType.id.value, alias]));
const makeEvent = ({ type, value }: Input): object => type === 'string' ? new OracleDomainText(value!) :
    type === 'shared' ? new OracleDomainShared(value!) : type === 'removed' ? new OracleDomainRemoved(value!) :
        type === 'expired' ? new OracleDomainExpired(value!) : new OracleDomainCleared();
const historyOf = (scenario: EventScenario): History[] => scenario.appendedEvents.map(entry => ({
    sequence: entry.context.sequenceNumber.toString(), source: entry.context.eventSourceId,
    sourceType: entry.context.eventSourceType, streamType: entry.context.eventStreamType, streamId: entry.context.eventStreamId,
    type: entry.eventType.id.value, content: entry.content as Record<string, string>, hash: entry.context.hash
}));
const unsupported = async (action: () => unknown, reason: string) => {
    await Promise.resolve().then(action).then(() => { throw new Error('Expected rejection'); }, error => {
        (error instanceof UnsupportedEventSequenceOperation).should.be.true;
        (error as Error).message.should.include(reason);
        (error as Error).message.should.include('Use a kernel-backed test.');
    });
};

describe('fixture-backed unique-property lifecycle', () => {
    for (const [name, constraints, selected] of [
        ['constraints-property-lifecycle', [LifecycleKey], Object.values(aliases)],
        ['constraints-property-covered-removal', [CoveredRemoval], [OracleDomainText, OracleDomainShared]]
    ] as const) {
        it(`matches the pinned kernel ${name}: raw and mapped violations, ownership, hashes and rollback`, async () => {
            const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Fixture;
            const ids = new Set(selected.map(type => type.name));
            Object.fromEntries(Object.entries(aliases).filter(([, type]) => ids.has(type.name)).map(([alias, type]) => {
                const metadata = getEventTypeMetadata(type)!;
                return [alias, { eventTypeId: metadata.eventType.id.value,
                    properties: Object.fromEntries(Object.entries(metadata.schema.properties ?? {}).map(([key, property]) => [key, property.type])) }];
            })).should.deep.equal(fixture.eventSchemas);
            const compiled = compileConstraints({ eventTypes: [...selected], constraints: [...constraints] });
            [...compiled].map(([key, capture]) => ({ kind: 'uniqueProperty', name: key,
                events: capture.uniqueConstraint!.eventDefinitions.map(entry => ({ type: aliasById[entry.eventTypeId], properties: entry.properties })),
                ignoreCasing: capture.uniqueConstraint!.ignoreCasing,
                removedWithEventTypeIds: (capture.uniqueConstraint!.removedWithEventTypeIds ?? [])
                    .map(id => aliasById[id]), message: capture.uniqueConstraint!.message ?? ''
            })).should.deep.equal(fixture.constraintDefinitions);
            fixture.isolatedConstraintOperations.length.should.be.greaterThan(0);
            fixture.expected.outcomes.length.should.equal(fixture.isolatedConstraintOperations.length);
            const scenario = new EventScenario({ artifacts: { eventTypes: [...selected], constraints: [...constraints] } });
            const notifications = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
            const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
            let count = 0;
            try {
                for (const [index, operation] of fixture.isolatedConstraintOperations.entries()) {
                    const expected = fixture.expected.outcomes[index];
                    const before = historyOf(scenario);
                    const nextNotification = notifications.next();
                    const results = operation.mode === 'single'
                        ? [await scenario.append(operation.events[0].source, makeEvent(operation.events[0]))]
                        : await scenario.appendMany(operation.events.map(entry => ({ eventSourceId: entry.source, event: makeEvent(entry) })));
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

    it('rolls back removal in a failing setup call without results or notifications', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: Object.values(aliases), constraints: [LifecycleKey] } });
        const notifications = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
        try {
            const first = notifications.next();
            await scenario.given.forEventSource('A').events(new OracleDomainText('Alpha'));
            (await first).value!.length.should.equal(1);
            const second = notifications.next();
            await scenario.given.forEventSource('B').events(new OracleDomainShared('Beta'));
            (await second).value!.length.should.equal(1);
            const before = historyOf(scenario);
            await scenario.given.forEventSource('A').events(new OracleDomainRemoved('end'), new OracleDomainShared('Beta'))
                .then(() => { throw new Error('Invalid setup succeeded'); }, error => {
                    (error as Error).message.should.include('EventScenario given setup failed');
                });
            historyOf(scenario).should.deep.equal(before);
            scenario.results.length.should.equal(0);
            (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(2n);
            const next = notifications.next();
            (await scenario.append('C', new OracleDomainShared('Alpha'))).constraintViolations.length.should.equal(1);
            (await next).value!.map(item => item.event.eventType.id.value).should.deep.equal(['OracleDomainShared']);
        } finally { await notifications.return?.(); }
    });

    it('delivers only committed claim/removal events to a reactor', async () => {
        const calls: string[] = [];
        @reactor('lifecycle-reactor')
        class LifecycleReactor {
            oracleDomainText(event: OracleDomainText) { calls.push(event.key); }
            oracleDomainRemoved(event: OracleDomainRemoved) { calls.push(event.label); }
        }
        const subject = new ReactorScenario(LifecycleReactor,
            { artifacts: { eventTypes: Object.values(aliases), constraints: [LifecycleKey] } });
        await subject.when.forEventSource('A').events(new OracleDomainText('Alpha'));
        await subject.when.forEventSource('B').events(new OracleDomainText('Alpha'))
            .then(() => { throw new Error('Duplicate claim delivered'); }, error => {
                (error as Error).message.should.include('ReactorScenario action append failed');
            });
        calls.should.deep.equal(['Alpha']);
        subject.results.length.should.equal(1);
        await subject.when.forEventSource('A').events(new OracleDomainRemoved('released'));
        await subject.when.forEventSource('B').events(new OracleDomainText('Alpha'));
        calls.should.deep.equal(['Alpha', 'released', 'Alpha']);
        subject.results.length.should.equal(3);
    });

    it('rejects a removal type shared by two definitions without claiming kernel semantics', async () => {
        class FirstClaim { @field(String) key = 'Alpha'; }
        eventType('FirstRemovalClaim')(FirstClaim);
        class SecondClaim { @field(String) key = 'Beta'; }
        eventType('SecondRemovalClaim')(SecondClaim);
        class SharedRemoval { @field(String) label = 'end'; }
        eventType('SharedRemoval')(SharedRemoval);
        class FirstKey implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(FirstClaim, event => event.key).removedWith(SharedRemoval));
            }
        }
        constraint('FirstRemovalKey')(FirstKey);
        class SecondKey implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(SecondClaim, event => event.key).removedWith(SharedRemoval));
            }
        }
        constraint('SecondRemovalKey')(SecondKey);
        await unsupported(() => new EventScenario({ artifacts: {
            eventTypes: [FirstClaim, SecondClaim, SharedRemoval], constraints: [FirstKey, SecondKey]
        } }), 'Removal type shared by several definitions is not fixture-backed.');
    });

    it('rejects unresolved removal names and unproven cross-definition interactions before mutation', async () => {
        class Missing { @field(String) label = 'missing'; }
        eventType('MissingLifecycleRemoval')(Missing);
        removeConstraint('NotDefined')(Missing);
        await unsupported(() => new EventScenario({ artifacts: { eventTypes: [Missing, OracleDomainText], constraints: [LifecycleKey] } }),
            'Unresolved removal constraint name');
        class Other implements IConstraint {
            define(builder: IConstraintBuilder) { builder.unique(key => key.on(OracleDomainRemoved, event => event.label)); }
        }
        constraint('OtherLifecycleKey')(Other);
        await unsupported(() => new EventScenario({ artifacts: { eventTypes: Object.values(aliases), constraints: [LifecycleKey, Other] } }),
            'Removal overlapping another validating definition');
        const scenario = new EventScenario({ artifacts: { eventTypes: Object.values(aliases), constraints: [LifecycleKey] } });
        (await scenario.append('A', new OracleDomainText('Alpha'))).isSuccess.should.be.true;
        const before = historyOf(scenario);
        const results = scenario.results;
        await unsupported(() => scenario.appendMany([{ eventSourceId: 'A', event: new OracleDomainRemoved('end') },
            { eventSourceId: 'B', event: new OracleDomainText('unproven!') }]), 'artifacts.constraints');
        historyOf(scenario).should.deep.equal(before);
        scenario.results.should.deep.equal(results);
        (await scenario.append('B', new OracleDomainText('Alpha'))).constraintViolations.length.should.equal(1);
    });
});
