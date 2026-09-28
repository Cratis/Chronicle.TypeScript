// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { chai, describe, it, vi } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType } from '../events/eventTypeDecorator.js';
import { unique } from '../events/constraints/unique.js';
import { constraint } from '../events/constraints/constraint.js';
import { compileConstraints } from '../events/constraints/Constraints.js';
import type { IConstraint } from '../events/constraints/IConstraint.js';
import type { IConstraintBuilder } from '../events/constraints/IConstraintBuilder.js';
import { removeConstraint } from '../events/constraints/removeConstraint.js';
import { ReactorScenario } from './ReactorScenario.js';
import { InProcessConstraints } from './InProcessConstraints.js';
import { reactor } from '../reactors/reactor.js';
import { EventScenario, UnsupportedEventSequenceOperation } from './index.js';

chai.should();
class OracleKeyClaimed {
    @field(String) @unique('OracleKey', 'Already claimed: {PropertyName}={PropertyValue}') key: string;
    constructor(key: string) { this.key = key; }
}
eventType('OracleKeyClaimed')(OracleKeyClaimed);
class OracleKeyShared {
    @field(String) @unique('OracleKey') key: string;
    constructor(key: string) { this.key = key; }
}
eventType('OracleKeyShared')(OracleKeyShared);
class OracleOnceRecorded {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('OracleOnceRecorded')(OracleOnceRecorded);
unique('OracleOnce')(OracleOnceRecorded);
class BatchUniqueRecorded {
    @field(String) @unique('BatchUniqueKey') key: string;
    constructor(key: string) { this.key = key; }
}
eventType('BatchUniqueRecorded')(BatchUniqueRecorded);
class OracleFluentOnce {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('OracleFluentOnce')(OracleFluentOnce);
class OracleNamedOnce {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('OracleNamedOnce')(OracleNamedOnce);
unique('OracleNamedOnce', 'Already recorded this kind of event')(OracleNamedOnce);
class OracleFluentOnceConstraint implements IConstraint {
    define(builder: IConstraintBuilder) { builder.uniqueFor(OracleFluentOnce, undefined, 'OracleFluentOnceConstraint'); }
}
constraint('OracleFluentOnceConstraint')(OracleFluentOnceConstraint);
const types = [OracleKeyClaimed, OracleKeyShared, OracleOnceRecorded, BatchUniqueRecorded, OracleFluentOnce, OracleNamedOnce];
const scenario = () => new EventScenario({ artifacts: { eventTypes: types, constraints: [OracleFluentOnceConstraint] } });
type Input = { source: string; type: 'key' | 'shared' | 'once' | 'plain' | 'fluentOnce' | 'namedOnce'; value: string };
type Outcome = { success: boolean; sequences: string[];
    wireViolations: Array<{ EventTypeId: string; SequenceNumber: string; ConstraintType: number;
        ConstraintName: string; Message: string; Details: Record<string, string> }>;
    violations: Array<{ id: string; message: string; details: Record<string, string> }>;
    errors: string[]; next: string; history: Array<{ sequence: string; source: string; type: string; value: string }> };
type Fixture = { constraintOperations: Array<{ mode: 'single' | 'batch'; events: Input[] }>;
    expected: { outcomes: Outcome[] } };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/constraints.json', import.meta.url), 'utf8')) as Fixture;
const value = (input: Input) => input.type === 'key' ? new OracleKeyClaimed(input.value) :
    input.type === 'shared' ? new OracleKeyShared(input.value) :
        input.type === 'once' ? new OracleOnceRecorded(input.value) :
            input.type === 'fluentOnce' ? new OracleFluentOnce(input.value) :
                input.type === 'namedOnce' ? new OracleNamedOnce(input.value) : new BatchUniqueRecorded(input.value);

const unsupported = (action: () => unknown, operation: string): UnsupportedEventSequenceOperation => {
    try { action(); throw new Error('Expected rejection'); }
    catch (error) {
        (error instanceof UnsupportedEventSequenceOperation).should.be.true;
        (error as Error).message.should.include(operation);
        (error as Error).message.should.include('Use a kernel-backed test.');
        return error as UnsupportedEventSequenceOperation;
    }
};

describe('fixture-backed unscoped constraints', () => {
    it('matches kernel violation messages, details, sequence normalization and batch rollback', async () => {
        const subject = scenario();
        const notifications = subject.eventSequence.appendOperations[Symbol.asyncIterator]();
        const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
        let resultCount = 0;
        try {
            for (const [index, operation] of fixture.constraintOperations.entries()) {
                const expected = fixture.expected.outcomes[index];
                const nextNotification = notifications.next();
                const results = operation.mode === 'single'
                    ? [await subject.append(operation.events[0].source, value(operation.events[0]))]
                    : await subject.appendMany(operation.events.map(entry => ({ eventSourceId: entry.source, event: value(entry) })));
                const notification = (await nextNotification).value!;
                const wireViolations = validate.mock.results.at(-1)?.value as ReturnType<InProcessConstraints['validate']>;
                wireViolations.map(({ SequenceNumber, ...violation }) => ({ ...violation, SequenceNumber: SequenceNumber.toString() }))
                    .should.deep.equal(expected.wireViolations);
                notification.length.should.equal(operation.events.length);
                notification.every(item => item.result.isSuccess === expected.success).should.be.true;
                resultCount += operation.events.length;
                subject.results.length.should.equal(resultCount);
                results.length.should.equal(operation.events.length);
                for (const result of results) {
                    result.isSuccess.should.equal(expected.success);
                    result.constraintViolations.map(item => ({ id: item.constraintId, message: item.message, details: item.details }))
                        .should.deep.equal(expected.violations);
                    result.errors.map(item => item.message).should.deep.equal(expected.errors);
                    result.sequenceNumber.value.toString().should.equal(expected.success ?
                        expected.sequences[results.indexOf(result)] : '0');
                    if (!expected.success) (await result.waitForCompletion()).should.deep.equal({ isSuccess: true, failedPartitions: [] });
                }
                subject.appendedEvents.map(item => ({ sequence: item.context.sequenceNumber.toString(),
                    source: item.context.eventSourceId, type: item.eventType.id.value,
                    value: item.content.key ?? item.content.label })).should.deep.equal(expected.history);
                (await subject.eventSequence.getNextSequenceNumber()).value.toString().should.equal(expected.next);
            }
            subject.then.results.should.deep.equal(subject.results);
        } finally {
            validate.mockRestore();
            await notifications.return?.();
        }
    });

    it('discovers fluent constraints by default when the selected catalog omits constraints', async () => {
        const subject = new EventScenario({ artifacts: { eventTypes: types } });
        (await subject.append('A', new OracleFluentOnce('first'))).isSuccess.should.be.true;
        (await subject.append('A', new OracleFluentOnce('second'))).constraintViolations[0]
            .constraintId.should.equal('OracleFluentOnceConstraint');
    });

    it('rejects a globally discovered fluent contribution sharing a selected decorator name', () => {
        class SelectedShared { @field(String) @unique('ScenarioSharedFromGlobal') key = 'Alpha'; }
        eventType('SelectedShared')(SelectedShared);
        class GlobalShared { @field(String) key = 'Alpha'; }
        eventType('GlobalShared')(GlobalShared);
        class GlobalSharedConstraint implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(GlobalShared, event => event.key)
                    .withMessage('Global configured: {PropertyValue}'));
            }
        }
        constraint('ScenarioSharedFromGlobal')(GlobalSharedConstraint);
        const production = compileConstraints({ eventTypes: [SelectedShared], constraints: [GlobalSharedConstraint] });
        production.get('ScenarioSharedFromGlobal')!.uniqueConstraint!.message.should.equal('Global configured: {PropertyValue}');
        production.get('ScenarioSharedFromGlobal')!.uniqueConstraint!.eventDefinitions.length.should.equal(2);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [SelectedShared] } }), 'artifacts.constraints')
            .message.should.include('Every constrained event type must be in the selected catalog.');
    });

    it('rejects a global property decorator sharing a selected name instead of losing its message', () => {
        class GlobalDecorated { @field(String) @unique('ScenarioSharedDecorators', 'Global message: {PropertyValue}') key = 'Alpha'; }
        eventType('GlobalDecorated')(GlobalDecorated);
        class SelectedDecorated { @field(String) @unique('ScenarioSharedDecorators') key = 'Alpha'; }
        eventType('SelectedDecorated')(SelectedDecorated);
        const production = compileConstraints({ eventTypes: [GlobalDecorated, SelectedDecorated], constraints: [] });
        production.get('ScenarioSharedDecorators')!.uniqueConstraint!.message.should.equal('Global message: {PropertyValue}');
        production.get('ScenarioSharedDecorators')!.uniqueConstraint!.eventDefinitions.length.should.equal(2);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [SelectedDecorated] } }), 'artifacts.constraints')
            .message.should.include('Every constrained event type must be in the selected catalog.');
    });

    it('rejects a same-named global class decorator as a multi-type unique event constraint', () => {
        class GlobalOnce { @field(String) label = 'global'; }
        eventType('GlobalOnce')(GlobalOnce);
        unique('ScenarioSharedOnce')(GlobalOnce);
        class SelectedOnce { @field(String) label = 'selected'; }
        eventType('SelectedOnce')(SelectedOnce);
        unique('ScenarioSharedOnce')(SelectedOnce);
        const production = compileConstraints({ eventTypes: [GlobalOnce, SelectedOnce], constraints: [] });
        production.get('ScenarioSharedOnce')!.uniqueEventType!.eventTypeIds.should.deep.equal(['GlobalOnce', 'SelectedOnce']);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [SelectedOnce] } }), 'artifacts.constraints')
            .message.should.include('multi-type unique event cycles');
    });

    it('rejects a global removal decorator targeting a selected constraint', () => {
        class SelectedClaim { @field(String) @unique('ScenarioRemovedGlobally') key = 'Alpha'; }
        eventType('SelectedClaim')(SelectedClaim);
        class GlobalRemoval { @field(String) label = 'removed'; }
        eventType('GlobalRemoval')(GlobalRemoval);
        removeConstraint('ScenarioRemovedGlobally')(GlobalRemoval);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [SelectedClaim] } }), 'artifacts.constraints')
            .message.should.include('removal');
    });

    it('rejects a globally discovered fluent constraint referencing a selected removal event', () => {
        class GlobalClaim { @field(String) key = 'Alpha'; }
        eventType('GlobalClaim')(GlobalClaim);
        class SelectedRemoval { @field(String) label = 'removed'; }
        eventType('SelectedRemoval')(SelectedRemoval);
        class GlobalRemovalConstraint implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(GlobalClaim, event => event.key).removedWith(SelectedRemoval));
            }
        }
        constraint('ScenarioGlobalRemoval')(GlobalRemovalConstraint);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [SelectedRemoval] } }), 'artifacts.constraints')
            .message.should.include('removal');
    });

    it('rejects a globally discovered constraint named by a selected removal decorator', () => {
        class GlobalDecoratedClaim { @field(String) key = 'Alpha'; }
        eventType('GlobalDecoratedClaim')(GlobalDecoratedClaim);
        class SelectedDecoratedRemoval { @field(String) label = 'removed'; }
        eventType('SelectedDecoratedRemoval')(SelectedDecoratedRemoval);
        removeConstraint('ScenarioDecoratedGlobalRemoval')(SelectedDecoratedRemoval);
        class DecoratedGlobalRemovalConstraint implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(GlobalDecoratedClaim, event => event.key));
            }
        }
        constraint('ScenarioDecoratedGlobalRemoval')(DecoratedGlobalRemovalConstraint);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [SelectedDecoratedRemoval] } }), 'artifacts.constraints')
            .message.should.include('removal');
    });

    it('isolates a selected catalog from unrelated globally discovered constraints', async () => {
        class Unrelated { @field(String) label = 'unrelated'; }
        eventType('Unrelated')(Unrelated);
        class UnrelatedConstraint implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(Unrelated, event => event.label).ignoreCasing());
            }
        }
        constraint('UnrelatedConstraint')(UnrelatedConstraint);
        const subject = new EventScenario({ artifacts: { eventTypes: types } });
        (await subject.append('A', new OracleFluentOnce('first'))).isSuccess.should.be.true;
        (await subject.append('A', new OracleFluentOnce('second'))).constraintViolations.length.should.equal(1);
    });

    it('uses the same compiler for an unscoped fluent constraint', async () => {
        class FluentKey implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(OracleKeyClaimed, event => event.key)
                    .on(OracleKeyShared, event => event.key)
                    .withMessage('Already claimed: {PropertyName}={PropertyValue}'));
            }
        }
        constraint('OracleKey')(FluentKey);
        const subject = new EventScenario({ artifacts: { eventTypes: types, constraints: [FluentKey] } });
        (await subject.append('A', new OracleKeyClaimed('Alpha'))).isSuccess.should.be.true;
        (await subject.append('B', new OracleKeyShared('Alpha'))).constraintViolations[0]
            .message.should.equal(fixture.expected.outcomes[2].violations[0].message);
    });

    it('passes constraints through ReactorScenario and does not deliver rejected events', async () => {
        const calls: string[] = [];
        @reactor('constrained-reactor')
        class ConstrainedReactor {
            oracleKeyClaimed(event: OracleKeyClaimed) { calls.push(event.key); }
        }
        const subject = new ReactorScenario(ConstrainedReactor, { artifacts: { eventTypes: types } });
        await subject.when.forEventSource('A').events(new OracleKeyClaimed('Alpha'));
        await subject.when.forEventSource('B').events(new OracleKeyClaimed('Alpha'))
            .then(() => { throw new Error('Constraint violation was delivered'); }, error => {
                (error as Error).message.should.include('ReactorScenario action append failed');
                (error as Error).message.should.include('OracleKey');
                (error as Error).message.should.include('Already claimed: key=Alpha');
            });
        calls.should.deep.equal(['Alpha']);
        subject.results.length.should.equal(1);
    });

    it('rolls back a violating given call without publishing setup results', async () => {
        const subject = scenario();
        await subject.given.forEventSource('A').events(new OracleKeyClaimed('Alpha'));
        await subject.given.forEventSource('B').events(new OracleOnceRecorded('one'), new OracleKeyShared('Alpha'))
            .then(() => { throw new Error('Violated setup accepted'); }, error => {
                (error as Error).message.should.include('EventScenario given setup failed');
                (error as Error).message.should.include('Already claimed: key=Alpha');
            });
        subject.appendedEvents.length.should.equal(1);
        subject.results.length.should.equal(0);
        (await subject.eventSequence.getNextSequenceNumber()).value.should.equal(1n);
    });

    it('rejects unproven numeric constrained schemas at construction', () => {
        class NumericConstrained { @field(Number) @unique('NumberKey') key = 1; }
        eventType('NumericConstrained')(NumericConstrained);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [NumericConstrained] } }), 'artifacts.constraints');
    });

    it('rejects a selected constraint covering an event outside the selected catalog', () => {
        class OutOfCatalog implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(OracleFluentOnce, event => event.label).on(OracleKeyShared, event => event.key));
            }
        }
        constraint('OutOfCatalog')(OutOfCatalog);
        const subject = scenario();
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [OracleFluentOnce], constraints: [OutOfCatalog] } }),
            'artifacts.constraints').message.should.include('Every constrained event type must be in the selected catalog.');
        subject.results.length.should.equal(0);
        subject.appendedEvents.length.should.equal(0);
    });

    it('reads a getter-backed selected constraint catalog only once', () => {
        class OutOfCatalog implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(OracleFluentOnce, event => event.label).on(OracleKeyShared, event => event.key));
            }
        }
        constraint('GetterOutOfCatalog')(OutOfCatalog);
        let reads = 0;
        const artifacts = { eventTypes: [OracleFluentOnce], get constraints() { reads++; return reads === 1 ? [OutOfCatalog] : undefined; } };
        unsupported(() => new EventScenario({ artifacts }), 'artifacts.constraints');
        reads.should.equal(1);
    });

    it('rejects a selected constraint without @constraint metadata', () => {
        class MissingMetadata implements IConstraint { define(_builder: IConstraintBuilder) {} }
        unsupported(() => new EventScenario({ artifacts: { eventTypes: types, constraints: [MissingMetadata] } }),
            'artifacts.constraints').message.should.include('Every selected constraint must have @constraint metadata.');
    });

    it('rejects overlapping property constraints and property plus event-type constraints at construction', () => {
        class TwoProperties {
            @field(String) @unique('FirstProperty') first = 'Alpha';
            @field(String) @unique('SecondProperty') second = 'Beta';
        }
        eventType('TwoProperties')(TwoProperties);
        class PropertyAndType { @field(String) @unique('PropertyName') name = 'Alpha'; }
        eventType('PropertyAndType')(PropertyAndType);
        unique('ClassName')(PropertyAndType);
        for (const type of [TwoProperties, PropertyAndType]) {
            unsupported(() => new EventScenario({ artifacts: { eventTypes: [type, OracleFluentOnce], constraints: [OracleFluentOnceConstraint] } }),
                'artifacts.constraints').message.should.include('Overlapping constraints');
        }
    });

    it('rejects a fresh-source key replacement within one batch without changing results or history', async () => {
        const subject = scenario();
        await subject.append('A', new OracleKeyClaimed('Alpha'));
        const history = subject.appendedEvents;
        const results = subject.results;
        await subject.appendMany('C', [new OracleKeyClaimed('First'), new OracleKeyShared('Second')])
            .then(() => { throw new Error('In-batch replacement accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include('artifacts.constraints');
                (error as Error).message.should.include('Replacing a key within one batch');
                (error as Error).message.should.include('Use a kernel-backed test.');
            });
        subject.appendedEvents.should.deep.equal(history);
        subject.results.should.deep.equal(results);
    });

    it('rejects history with an unproven unique key without changing scenario state', async () => {
        const subject = scenario();
        await subject.append('A', new OracleKeyClaimed('Alpha'));
        const history = subject.appendedEvents;
        const incoming = subject.appendedEvents;
        history[0].content.key = 1;
        const compiled = compileConstraints({ eventTypes: types, constraints: [OracleFluentOnceConstraint] });
        const checker = new InProcessConstraints(compiled);
        unsupported(() => checker.validate(history, incoming), 'artifacts.constraints');
        subject.appendedEvents[0].content.key.should.equal('Alpha');
        subject.results.length.should.equal(1);
    });

    it('rejects removal, scoped, composite, case-insensitive and replacement before mutation', async () => {
        const scoped = (configure: (builder: IConstraintBuilder) => void) => {
            class InvalidConstraint implements IConstraint {
                define(builder: IConstraintBuilder) { configure(builder); }
            }
            constraint('ScopedOrComposite')(InvalidConstraint);
            unsupported(() => new EventScenario({ artifacts: { eventTypes: types, constraints: [InvalidConstraint] } }), 'artifacts.constraints');
        };
        scoped(builder => builder.perEventStreamId().unique(key => key.on(OracleKeyClaimed, event => event.key)));
        scoped(builder => builder.perEventStreamType().unique(key => key.on(OracleKeyClaimed, event => event.key)));
        scoped(builder => builder.perEventSourceType().unique(key => key.on(OracleKeyClaimed, event => event.key)));
        scoped(builder => builder.unique(key => key.on(OracleKeyClaimed, event => event.key, event => event.key)));
        scoped(builder => builder.unique(key => key.on(OracleKeyClaimed, event => event.key).ignoreCasing()));
        scoped(builder => builder.unique(key => key.on(OracleKeyClaimed, event => event.key))
            .uniqueFor(OracleOnceRecorded));
        class Removal { @field(String) label = 'removed'; }
        eventType('Removal')(Removal);
        removeConstraint('OracleKey')(Removal);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [...types, Removal], constraints: [OracleFluentOnceConstraint] } }), 'artifacts.constraints')
            .message.should.include('removal');
        class AnotherOnce { @field(String) label = 'second'; }
        eventType('AnotherOnce')(AnotherOnce);
        unique('OracleOnce')(AnotherOnce);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [...types, AnotherOnce], constraints: [OracleFluentOnceConstraint] } }), 'artifacts.constraints')
            .message.should.include('multi-type unique event cycles');
        const subject = scenario();
        await subject.append('A', new OracleKeyClaimed('Alpha'));
        await subject.append('B', new OracleKeyClaimed('beta'));
        for (const action of [() => subject.append('A', new OracleKeyClaimed('different')),
            () => subject.appendMany('A', [new OracleKeyClaimed('Alpha'), new OracleKeyClaimed('changed')]),
            () => subject.append('C', new OracleKeyClaimed('!'))]) {
            await action().then(() => { throw new Error('Unsupported key accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include('artifacts.constraints');
                (error as Error).message.should.include('Use a kernel-backed test.');
            });
            subject.appendedEvents.length.should.equal(2);
            subject.results.length.should.equal(2);
        }
    });

    it('wraps throwing and duplicate fluent definitions as unsupported compiler errors', () => {
        class Throws implements IConstraint { define(_builder: IConstraintBuilder) { throw new Error('Invalid definition'); } }
        constraint('Throws')(Throws);
        class First implements IConstraint { define(builder: IConstraintBuilder) { builder.uniqueFor(OracleOnceRecorded); } }
        class Second implements IConstraint { define(builder: IConstraintBuilder) { builder.uniqueFor(OracleOnceRecorded); } }
        constraint('Duplicate')(First);
        constraint('Duplicate')(Second);
        for (const constraints of [[Throws], [First, Second]]) {
            unsupported(() => new EventScenario({ artifacts: { eventTypes: types, constraints } }),
                'artifacts.constraints').message.should.include('compiler');
        }
    });
});
