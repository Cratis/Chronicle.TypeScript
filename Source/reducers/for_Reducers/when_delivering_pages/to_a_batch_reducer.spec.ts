// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationOrigin as ContractObservationOrigin, ObservationState, type RegisterReducer, type ReducerResult } from '@cratis/chronicle.contracts';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { BatchContext, EventBatch, ObservationOrigin, batchSize, observes } from '../../../observation/index.js';
import { reducer } from '../../reducer.js';
import { appended, observeReducerMessages, page } from '../given/observe_reducer_messages.js';

chai.should();

@eventType('batch-reducer-money-deposited')
class MoneyDeposited {
    constructor(readonly amount: number = 0) {}
}

@eventType('batch-reducer-money-withdrawn')
class MoneyWithdrawn {
    constructor(readonly amount: number = 0) {}
}

interface Balance {
    readonly balance: number;
}

describe('when delivering a page to a reducer with a batch method', () => {
    let calls: { partitions: readonly string[]; current: Balance | undefined; count: number }[];
    let contexts: BatchContext[];
    let registration: RegisterReducer;
    let results: ReducerResult[];

    beforeEach(async () => {
        calls = [];
        contexts = [];

        @reducer('batch-balances')
        @batchSize({ maxConcurrency: 1, maxEvents: 250 })
        class Balances {
            @observes(MoneyDeposited)
            @observes(MoneyWithdrawn)
            reduce(events: EventBatch, current: Balance | undefined, context: BatchContext): Balance | undefined {
                calls.push({ partitions: events.partitions, current, count: events.length });
                contexts.push(context);
                if (events.partitions[0] === 'throttled') {
                    events.defer('throttled', 750);
                    return current;
                }
                if (events.partitions[0] === 'rejected') {
                    events.fail(events.events[1].context, new Error('overdrawn'));
                    return current;
                }
                return events.events.reduce((balance, entry) => ({
                    balance: balance.balance + (entry.is(MoneyDeposited) ? entry.event.amount : entry.is(MoneyWithdrawn) ? -entry.event.amount : 0)
                }), current ?? { balance: 0 });
            }
        }

        ({ registration, results } = await observeReducerMessages(Balances, [MoneyDeposited, MoneyWithdrawn], [page(9n, {
            existing: { initialState: { balance: 100 }, events: [
                appended('batch-reducer-money-deposited', 'existing', 1n, { amount: 50 }),
                appended('batch-reducer-money-withdrawn', 'existing', 3n, { amount: 30 })
            ] },
            fresh: { events: [appended('batch-reducer-money-deposited', 'fresh', 2n, { amount: 10 })] },
            throttled: { events: [appended('batch-reducer-money-deposited', 'throttled', 4n, { amount: 1 })] },
            rejected: { initialState: { balance: 5 }, events: [
                appended('batch-reducer-money-deposited', 'rejected', 5n, { amount: 1 }),
                appended('batch-reducer-money-withdrawn', 'rejected', 6n, { amount: 100 })
            ] }
        }, ContractObservationOrigin.Replaying)]));
    });

    const resultFor = (partition: string) => results[0].Partitions.find(result => result.Partition === partition)!;

    it('should register the observed event types and the declared bounds', () => {
        registration.Reducer!.EventTypes.map(eventType => eventType.EventType!.Id).sort()
            .should.deep.equal(['batch-reducer-money-deposited', 'batch-reducer-money-withdrawn']);
        registration.PageDelivery!.should.deep.equal({ Enabled: true, MaxEventsPerPage: 250, MaxBytesPerPage: 0, MaxDelayMilliseconds: 0 });
    });
    it('should call the batch method once per event source with its events and stored state', () =>
        calls.should.deep.equal([
            { partitions: ['existing'], current: { balance: 100 }, count: 2 },
            { partitions: ['fresh'], current: undefined, count: 1 },
            { partitions: ['throttled'], current: undefined, count: 1 },
            { partitions: ['rejected'], current: { balance: 5 }, count: 2 }
        ]));
    it('should describe the whole page in the batch context', () => {
        contexts[0].origin.should.equal(ObservationOrigin.Replay);
        contexts[0].isReplay.should.be.true;
        contexts[0].partitions.should.deep.equal(['existing', 'fresh', 'throttled', 'rejected']);
        contexts[0].eventCount.should.equal(6);
    });
    it('should echo the delivery identifier', () => results[0].DeliveryId.should.equal(9n));
    it('should write the next state of each event source', () => {
        resultFor('existing').State.should.equal(ObservationState.Success);
        JSON.parse(resultFor('existing').ReadModelState).should.deep.equal({ balance: 120 });
        resultFor('existing').LastSuccessfulObservation.should.equal(3n);
        JSON.parse(resultFor('fresh').ReadModelState).should.deep.equal({ balance: 10 });
    });
    it('should defer an event source without writing its state', () => {
        resultFor('throttled').State.should.equal(ObservationState.Deferred);
        resultFor('throttled').RetryAfterMilliseconds.should.equal(750n);
        resultFor('throttled').ReadModelState.should.equal('');
    });
    it('should fail an event source without writing its state', () => {
        resultFor('rejected').State.should.equal(ObservationState.Failed);
        resultFor('rejected').ExceptionMessages.should.deep.equal(['Error: overdrawn']);
        resultFor('rejected').ReadModelState.should.equal('');
        resultFor('rejected').LastSuccessfulObservation.should.equal(4294967295n);
    });
});
