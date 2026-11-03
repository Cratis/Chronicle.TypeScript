// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationState, type ReactorResult } from '@cratis/chronicle.contracts';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { BatchContext, EventBatch, observes } from '../../../observation/index.js';
import { reactor } from '../../reactor.js';
import { appended, observeReactorMessages, single } from '../given/observe_reactor_messages.js';

chai.should();

@eventType('legacy-order-placed')
class OrderPlaced {}

describe('when a kernel without page delivery sends a single partition to a batch reactor', () => {
    let canDefer: boolean[];
    let results: ReactorResult[];

    beforeEach(async () => {
        canDefer = [];

        @reactor('legacy-orders')
        class Orders {
            @observes(OrderPlaced)
            place(batch: EventBatch, context: BatchContext): void {
                canDefer.push(context.canDefer);
                if (batch.events.some(entry => entry.context.sequenceNumber === 3n)) batch.defer('order-1', 1000);
            }
        }

        ({ results } = await observeReactorMessages(Orders, [OrderPlaced], [
            single('order-1', [appended('legacy-order-placed', 'order-1', 1n), appended('legacy-order-placed', 'order-1', 2n)], 11n),
            single('order-1', [appended('legacy-order-placed', 'order-1', 3n)], 12n)
        ]));
    });

    it('should tell the batch method that it cannot defer', () => canDefer.should.deep.equal([false, false]));
    it('should reply in the legacy fields without per-partition results', () => {
        results[0].Partition.should.equal('order-1');
        results[0].State.should.equal(ObservationState.Success);
        results[0].LastSuccessfulObservation.should.equal(2n);
        results[0].Partitions.should.be.empty;
        results[0].DeliveryId.should.equal(11n);
    });
    it('should fail a deferral the kernel cannot take, and say why', () => {
        results[1].State.should.equal(ObservationState.Failed);
        results[1].LastSuccessfulObservation.should.equal(4294967295n);
        results[1].ExceptionMessages[0].should.contain('DeferralNotSupportedByKernel');
    });
});
