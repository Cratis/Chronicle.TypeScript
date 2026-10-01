// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import { unique } from '../../../events/constraints/unique.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import type { AppendOptions } from '../../../eventSequences/AppendOptions.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';

chai.should();
@eventType('ScopedGuardClaim')
class Claim { @field(String) key: string; @field(String) other = 'Other'; constructor(key: string) { this.key = key; } }
@eventType('ScopedGuardFlag')
class Flag { @field(Boolean) key = true; }
@eventType('ScopedGuardRemoval')
class Removed { @field(String) label = 'release'; }
@eventType('ScopedGuardFieldless')
class Fieldless {}

function definition(configure: (builder: IConstraintBuilder) => void, name = 'ScopedGuard'): Function {
    @constraint(name)
    class Definition { define(builder: IConstraintBuilder) { configure(builder); } }
    return Definition;
}
const scopedConstraint = definition(builder => builder.perEventStreamId().unique(value => value.on(Claim, event => event.key).removedWith(Removed)));
const create = () => new EventScenario({ artifacts: { eventTypes: [Claim, Removed], constraints: [scopedConstraint] } });
async function unsupported(action: () => unknown, reason: string): Promise<void> {
    await Promise.resolve().then(action).then(() => { throw new Error('Unsupported operation succeeded'); }, error => {
        (error instanceof UnsupportedEventSequenceOperation).should.be.true;
        (error as Error).message.should.include(reason);
        (error as Error).message.should.include('Use a kernel-backed test.');
    });
}

describe('when configuring unproven scoped property shapes', () => {
    for (const [name, configure, reason] of [
        ['composite', (builder: IConstraintBuilder) => builder.unique(value => value.on(Claim, event => event.key, event => event.other)), 'Scoped composite or case-insensitive property keys'],
        ['casing', (builder: IConstraintBuilder) => builder.unique(value => value.on(Claim, event => event.key).ignoreCasing()), 'Scoped composite or case-insensitive property keys'],
        ['boolean', (builder: IConstraintBuilder) => builder.unique(value => value.on(Flag, event => event.key)), 'Scoped property keys must be schema-backed strings'],
        ['covered removal', (builder: IConstraintBuilder) => builder.unique(value => value.on(Claim, event => event.key).removedWith(Claim)), 'Scoped covered-and-removal property events'],
        ['fieldless removal', (builder: IConstraintBuilder) => builder.unique(value => value.on(Claim, event => event.key).removedWith(Fieldless)), 'Scoped fieldless removal events']
    ] as const) {
        it(`should reject ${name} with its specific boundary rather than a compiler failure`, async () => {
            const eventTypes = name === 'fieldless removal' ? [Claim, Fieldless] : [Claim, Flag, Removed];
            new EventScenario({ artifacts: { eventTypes, constraints: [definition(configure)] } }).should.be.instanceOf(EventScenario);
            await unsupported(() => new EventScenario({ artifacts: { eventTypes,
                constraints: [definition(builder => { builder.perEventSourceType(); configure(builder); })] } }), reason);
        });
    }

    it('should reject a scoped definition alongside another nonoverlapping definition', async () => {
        const other = definition(builder => builder.unique(value => value.on(Flag, event => event.key)), 'OtherGuard');
        await unsupported(() => new EventScenario({ artifacts: { eventTypes: [Claim, Flag, Removed], constraints: [scopedConstraint, other] } }),
            'Scoped constraints alongside other definitions');
    });

    it('should retain the production compiler conflict between scoped fluent and unscoped unique decorators', async () => {
        @eventType('ScopedDecoratedConflict')
        class Decorated { @field(String) @unique('Conflict') key = 'key'; }
        const scoped = definition(builder => builder.perEventStreamId().unique(value => value.on(Decorated, event => event.key)), 'Conflict');
        await unsupported(() => new EventScenario({ artifacts: { eventTypes: [Decorated], constraints: [scoped] } }),
            "Conflicting scopes for constraint 'Conflict'");
    });
});

describe('when a scoped append uses unsupported routes or metadata', () => {
    it('should preserve claims, history, results, notifications and sequence after unsupported input', async () => {
        const scenario = create();
        (await scenario.append('A', new Claim('Alpha'), { streamId: 'West' })).isSuccess.should.be.true;
        const before = scenario.appendedEvents;
        const results = scenario.results;
        const notifications = scenario.eventLog.appendOperations[Symbol.asyncIterator]();
        const pending = notifications.next();
        try {
            for (const dimension of ['sourceType', 'streamType', 'streamId'] as const) {
                for (const value of [' ', 'a|estt:b', '*', 'a:b', 'é', 'a\u0000b']) {
                    const options = { [dimension]: value };
                    await unsupported(() => scenario.append('B', new Claim('Beta'), options), `append.${dimension}`);
                    await unsupported(() => scenario.appendMany('B', [new Claim('Beta')], options), `appendMany.${dimension}`);
                }
            }
            for (const options of [{ tags: [] }, { subject: '' }, { occurred: new Date() }, { correlationId: '00000000-0000-0000-0000-000000000001' },
                { concurrencyScopes: {} }, { eventSourceId: 'other' }, { arbitrary: true }]) {
                await unsupported(() => scenario.append('B', new Claim('Beta'), options as AppendOptions), 'append.options');
            }
            await unsupported(() => scenario.appendMany([
                { eventSourceId: 'A', event: new Removed(), eventStreamId: 'West' },
                { eventSourceId: 'B', event: new Claim('Alpha'), eventStreamId: 'bad|route' }
            ]), 'appendMany.streamId');
            scenario.appendedEvents.should.deep.equal(before);
            scenario.results.should.deep.equal(results);
            (await scenario.eventLog.getNextSequenceNumber()).value.should.equal(1n);
            const rejected = await scenario.append('B', new Claim('Alpha'), { streamId: 'West' });
            rejected.isSuccess.should.be.false;
            (await pending).value![0].result.should.equal(rejected);
            (await scenario.append('B', new Claim('Beta'), { streamId: 'West' })).sequenceNumber.value.should.equal(1n);
        } finally { await notifications.return?.(); }
    });

    it('should roll back default-route setup without disturbing another scope', async () => {
        const scenario = create();
        await scenario.append('A', new Claim('Alpha'), { streamId: 'West' });
        await scenario.given.forEventSource('A').events(new Claim('DefaultKey'));
        const before = scenario.appendedEvents;
        const results = scenario.results;
        await scenario.given.forEventSource('B').events(new Claim('Temporary'), new Claim('DefaultKey'))
            .then(() => { throw new Error('Invalid setup succeeded'); }, error => {
                (error as Error).message.should.include('EventScenario given setup failed');
            });
        scenario.appendedEvents.should.deep.equal(before);
        scenario.results.should.deep.equal(results);
        (await scenario.append('C', new Claim('Temporary'))).isSuccess.should.be.true;
        (await scenario.append('C', new Claim('Alpha'), { streamId: 'West' })).isSuccess.should.be.false;
    });
});
