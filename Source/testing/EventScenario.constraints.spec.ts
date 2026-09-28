// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType } from '../events/eventTypeDecorator.js';
import { unique } from '../events/constraints/unique.js';
import { constraint } from '../events/constraints/constraint.js';
import type { IConstraint } from '../events/constraints/IConstraint.js';
import type { IConstraintBuilder } from '../events/constraints/IConstraintBuilder.js';
import { removeConstraint } from '../events/constraints/removeConstraint.js';
import { ReactorScenario } from './ReactorScenario.js';
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

const unsupported = (action: () => unknown, operation: string) => {
    try { action(); throw new Error('Expected rejection'); }
    catch (error) {
        (error instanceof UnsupportedEventSequenceOperation).should.be.true;
        (error as Error).message.should.include(operation);
        (error as Error).message.should.include('Use a kernel-backed test.');
    }
};

describe('fixture-backed unscoped constraints', () => {
    it('matches kernel violation messages, details, sequence normalization and batch rollback', async () => {
        const subject = scenario();
        const notifications = subject.eventSequence.appendOperations[Symbol.asyncIterator]();
        let resultCount = 0;
        for (const [index, operation] of fixture.constraintOperations.entries()) {
            const expected = fixture.expected.outcomes[index];
            const nextNotification = notifications.next();
            const results = operation.mode === 'single'
                ? [await subject.append(operation.events[0].source, value(operation.events[0]))]
                : await subject.appendMany(operation.events.map(entry => ({ eventSourceId: entry.source, event: value(entry) })));
            const notification = (await nextNotification).value!;
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
        await notifications.return?.();
        subject.then.results.should.deep.equal(subject.results);
    });

    it('discovers fluent constraints by default when the selected catalog omits constraints', async () => {
        const subject = new EventScenario({ artifacts: { eventTypes: types } });
        (await subject.append('A', new OracleFluentOnce('first'))).isSuccess.should.be.true;
        (await subject.append('A', new OracleFluentOnce('second'))).constraintViolations[0]
            .constraintId.should.equal('OracleFluentOnceConstraint');
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
                (error as Error).message.should.include('action append failed');
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

    it('rejects non-string constrained schemas at construction', () => {
        class BoolConstrained { @field(Boolean) @unique('Flag') active = true; }
        eventType('BoolConstrained')(BoolConstrained);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [BoolConstrained] } }), 'artifacts.constraints');
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
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [...types, Removal] } }), 'artifacts.constraints');
        class AnotherOnce { @field(String) label = 'second'; }
        eventType('AnotherOnce')(AnotherOnce);
        unique('OracleOnce')(AnotherOnce);
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [...types, AnotherOnce] } }), 'artifacts.constraints');
        const subject = scenario();
        await subject.append('A', new OracleKeyClaimed('Alpha'));
        await subject.append('B', new OracleKeyClaimed('beta'));
        for (const action of [() => subject.append('A', new OracleKeyClaimed('different')),
            () => subject.appendMany('A', [new OracleKeyClaimed('Alpha'), new OracleKeyClaimed('changed')]),
            () => subject.append('C', new OracleKeyClaimed('é'))]) {
            await action().then(() => { throw new Error('Unsupported key accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include('Use a kernel-backed test.');
            });
            subject.appendedEvents.length.should.equal(2);
            subject.results.length.should.equal(2);
        }
    });
});
