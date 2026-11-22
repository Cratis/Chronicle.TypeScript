// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { EventScenario } from '../../EventScenario.js';
import { UnsupportedEventSequenceOperation } from '../../UnsupportedEventSequenceOperation.js';

chai.should();

function definition(configure: (builder: IConstraintBuilder) => void, name = 'UnprovenCombinedKey'): Constructor {
    class Definition { define(builder: IConstraintBuilder) { configure(builder); } }
    constraint(name)(Definition);
    return Definition;
}

async function rejectWithoutMutation(eventTypes: Constructor[], Claim: new () => { key: unknown }, invalid: Constructor, reason: string): Promise<void> {
    const supported = definition(builder => builder.unique(key => key.on(Claim, event => event.key)), 'SupportedCombinedKey');
    const scenario = new EventScenario({ artifacts: { eventTypes: [Claim], constraints: [supported] } });
    (await scenario.append('A', new Claim())).isSuccess.should.be.true;
    const history = [...scenario.appendedEvents];
    const results = [...scenario.results];
    (() => new EventScenario({ artifacts: { eventTypes, constraints: [invalid] } }))
        .should.throw(UnsupportedEventSequenceOperation, reason);
    scenario.appendedEvents.should.deep.equal(history);
    scenario.results.should.deep.equal(results);
    (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(1n);
    (await scenario.append('B', new Claim())).isSuccess.should.be.false;
    (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(1n);
}

export function definitionRejectionBehaviors(types: {
    guid: new () => { key: unknown };
    number: new () => { key: unknown };
    text: new () => { key: string };
    flag: new () => { key: boolean };
    fieldless: new () => object;
    removed: new () => { label: string };
}): void {
    for (const [kind, Claim] of [['Guid', types.guid], ['numeric', types.number]] as const) {
        describe(`when configuring unmeasured ${kind} definition combinations`, () => {
            it('should reject an unscoped fieldless remover without mutating claims or advancing a sequence', async () => {
                const invalid = definition(builder => builder.unique(key => key.on(Claim, event => event.key).removedWith(types.fieldless)));
                await rejectWithoutMutation([Claim, types.fieldless], Claim, invalid, 'fieldless removal events');
            });
            it('should reject an unscoped covered-and-removal event without mutating claims or advancing a sequence', async () => {
                const invalid = definition(builder => builder.unique(key => key.on(Claim, event => event.key).removedWith(Claim)));
                await rejectWithoutMutation([Claim], Claim, invalid, 'covered-and-removal events');
            });
            it('should reject a string covered-and-removal event shared with an extended key', async () => {
                const invalid = definition(builder => builder.unique(key => key.on(Claim, event => event.key)
                    .on(types.removed, event => event.label).removedWith(types.removed)));
                await rejectWithoutMutation([Claim, types.removed], Claim, invalid, 'covered-and-removal events');
            });
            for (let mask = 0; mask < 8; mask++) {
                for (const flagFirst of [false, true]) {
                    it(`should reject a shared Boolean/${kind} definition under scope ${mask}, Boolean first: ${flagFirst}`, async () => {
                        const invalid = definition(builder => {
                            if (mask & 1) builder.perEventSourceType();
                            if (mask & 2) builder.perEventStreamType();
                            if (mask & 4) builder.perEventStreamId();
                            builder.unique(key => {
                                if (flagFirst) key.on(types.flag, event => event.key);
                                key.on(Claim, event => event.key);
                                if (!flagFirst) key.on(types.flag, event => event.key);
                            });
                        });
                        await rejectWithoutMutation([Claim, types.flag], Claim, invalid, 'Boolean keys mixed with Guid or numeric keys');
                    });
                }
            }
        });
    }

    describe('when configuring existing string-key lifecycle shapes', () => {
        it('should retain unscoped fieldless-remover release and reclaim', async () => {
            const constraints = [definition(builder => builder.unique(key => key.on(types.text, event => event.key).removedWith(types.fieldless)))];
            const scenario = new EventScenario({ artifacts: { eventTypes: [types.text, types.fieldless], constraints } });
            const claim = () => Object.assign(new types.text(), { key: 'Alpha' });
            (await scenario.append('A', claim())).isSuccess.should.be.true;
            (await scenario.append('B', claim())).isSuccess.should.be.false;
            (await scenario.append('A', new types.fieldless())).isSuccess.should.be.true;
            (await scenario.append('B', claim())).sequenceNumber.value.should.equal(2n);
            (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(3n);
        });
        it('should retain unscoped string covered-and-removal events', async () => {
            const constraints = [definition(builder => builder.unique(key => key.on(types.text, event => event.key)
                .on(types.removed, event => event.label).removedWith(types.removed)))];
            const scenario = new EventScenario({ artifacts: { eventTypes: [types.text, types.removed], constraints } });
            const claim = () => Object.assign(new types.text(), { key: 'Alpha' });
            (await scenario.append('A', claim())).isSuccess.should.be.true;
            (await scenario.append('A', Object.assign(new types.removed(), { label: 'Alpha' }))).isSuccess.should.be.true;
            (await scenario.append('B', claim())).sequenceNumber.value.should.equal(2n);
            (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(3n);
        });
        for (const scoped of [false, true]) {
            it(`should retain a shared Boolean/string definition, scoped: ${scoped}`, async () => {
                const constraints = [definition(builder => {
                    if (scoped) builder.perEventStreamId();
                    builder.unique(key => key.on(types.flag, event => event.key).on(types.text, event => event.key));
                })];
                const scenario = new EventScenario({ artifacts: { eventTypes: [types.flag, types.text], constraints } });
                (await scenario.append('A', new types.flag())).isSuccess.should.be.true;
                (await scenario.append('B', Object.assign(new types.text(), { key: 'True' }))).isSuccess.should.be.false;
                (await scenario.append('B', Object.assign(new types.text(), { key: 'true' }))).sequenceNumber.value.should.equal(1n);
                (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(2n);
            });
        }
    });
}
