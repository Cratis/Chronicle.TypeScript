// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationState, type RegisterReactor, type ReactorResult } from '@cratis/chronicle.contracts';
import type { EventContext } from '../../../events/EventContext.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { reactor } from '../../reactor.js';
import { appended, observeReactorMessages, page } from '../given/observe_reactor_messages.js';

chai.should();

@eventType('paged-item-added')
class ItemAdded {}

describe('when delivering a page to a reactor with per-event handlers', () => {
    let calls: string[];
    let registration: RegisterReactor;
    let results: ReactorResult[];

    beforeEach(async () => {
        calls = [];

        @reactor('paged-per-event')
        class Items {
            itemAdded(_event: ItemAdded, context: EventContext) {
                calls.push(`${context.eventSourceId}:${context.sequenceNumber}`);
                if (context.sequenceNumber === 3n) throw new Error('second item of b failed');
            }
        }

        ({ registration, results } = await observeReactorMessages(Items, [ItemAdded], [page(42n, {
            a: [appended('paged-item-added', 'a', 1n), appended('paged-item-added', 'a', 4n)],
            b: [appended('paged-item-added', 'b', 2n), appended('paged-item-added', 'b', 3n), appended('paged-item-added', 'b', 5n)]
        })]));
    });

    it('should opt in to page delivery at registration', () => registration.PageDelivery!.Enabled.should.be.true);
    it('should call the handler for each event of each partition in order, and stop a partition at its failure', () =>
        calls.should.deep.equal(['a:1', 'a:4', 'b:2', 'b:3']));
    it('should echo the delivery identifier', () => results[0].DeliveryId.should.equal(42n));
    it('should reply with one result per partition', () => results[0].Partitions.map(result => result.Partition).should.deep.equal(['a', 'b']));
    it('should settle the healthy partition at its last event', () => {
        results[0].Partitions[0].State.should.equal(ObservationState.Success);
        results[0].Partitions[0].LastSuccessfulObservation.should.equal(4n);
    });
    it('should settle the failed partition at the event before its failure', () => {
        results[0].Partitions[1].State.should.equal(ObservationState.Failed);
        results[0].Partitions[1].LastSuccessfulObservation.should.equal(2n);
        results[0].Partitions[1].ExceptionMessages.should.deep.equal(['Error: second item of b failed']);
    });
});
