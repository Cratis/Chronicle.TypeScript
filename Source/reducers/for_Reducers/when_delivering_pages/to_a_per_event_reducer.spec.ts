// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationState, type RegisterReducer, type ReducerResult } from '@cratis/chronicle.contracts';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { reducer } from '../../reducer.js';
import { appended, observeReducerMessages, page, single } from '../given/observe_reducer_messages.js';

chai.should();

@eventType('per-event-reducer-item-counted')
class ItemCounted {}

interface Count {
    readonly count: number;
}

describe('when delivering pages and single partitions to a reducer with per-event methods', () => {
    let registration: RegisterReducer;
    let results: ReducerResult[];

    beforeEach(async () => {
        @reducer('per-event-counts')
        class Counts {
            itemCounted(_event: ItemCounted, current: Count | undefined): Count {
                if (current?.count === 1) throw new Error('count is stuck');
                return { count: (current?.count ?? 0) + 1 };
            }
        }

        ({ registration, results } = await observeReducerMessages(Counts, [ItemCounted], [
            page(3n, {
                first: { events: [appended('per-event-reducer-item-counted', 'first', 1n)] },
                stuck: { initialState: { count: 1 }, events: [appended('per-event-reducer-item-counted', 'stuck', 2n)] }
            }),
            single('legacy', [appended('per-event-reducer-item-counted', 'legacy', 4n)], { count: 5 })
        ]));
    });

    it('should opt in to page delivery', () => registration.PageDelivery!.Enabled.should.be.true);
    it('should fold each event source of a page on its own', () => {
        results[0].Partitions.map(result => result.State).should.deep.equal([ObservationState.Success, ObservationState.Failed]);
        JSON.parse(results[0].Partitions[0].ReadModelState).should.deep.equal({ count: 1 });
        results[0].Partitions[1].ExceptionMessages.should.deep.equal(['Error: count is stuck']);
    });
    it('should reply to a legacy single partition in the legacy fields', () => {
        results[1].Partition.should.equal('legacy');
        results[1].Partitions.should.be.empty;
        results[1].State.should.equal(ObservationState.Success);
        JSON.parse(results[1].ReadModelState).should.deep.equal({ count: 6 });
    });
});
