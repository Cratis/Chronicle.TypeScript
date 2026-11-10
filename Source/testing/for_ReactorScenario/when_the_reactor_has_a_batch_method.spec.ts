// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { BatchContext, BatchMethodReturnedAValue, BatchOutcomeKind, EventBatch, eventType, ObservationOrigin, observes, reactor } from '../../index.js';
import { ReactorScenario } from '../index.js';

chai.should();

@eventType('scenario-batch-shipment-sent')
class ShipmentSent {
    @field(String) trackingNumber: string;
    constructor(trackingNumber = '') { this.trackingNumber = trackingNumber; }
}

@eventType('scenario-batch-shipment-lost')
class ShipmentLost {
    @field(String) reason: string;
    constructor(reason = '') { this.reason = reason; }
}

@eventType('scenario-batch-shipment-delivered')
class ShipmentDelivered {
    @field(String) signedBy: string;
    constructor(signedBy = '') { this.signedBy = signedBy; }
}

let batches: { batch: EventBatch; context: BatchContext }[] = [];
let delivered: string[] = [];
let failing = '';
let deferring = '';
let throwing = false;

@reactor('scenario-batch-shipments')
class Shipments {
    @observes(ShipmentSent)
    @observes(ShipmentLost)
    track(batch: EventBatch, context: BatchContext) {
        batches.push({ batch, context });
        if (throwing) throw new Error('tracking service is down');
        if (failing) batch.fail(failing, new Error('unknown carrier'));
        if (deferring) batch.defer(deferring, 1000);
    }

    shipmentDelivered(event: ShipmentDelivered) {
        delivered.push(event.signedBy);
    }
}

const options = { artifacts: { eventTypes: [ShipmentSent, ShipmentLost, ShipmentDelivered] }, constraints: 'disabled' as const };

function reset() {
    batches = [];
    delivered = [];
    failing = '';
    deferring = '';
    throwing = false;
}

describe('when the events of one events call reach a batch method', () => {
    let scenario: ReactorScenario;
    beforeEach(async () => {
        reset();
        scenario = new ReactorScenario(Shipments, options);
        await scenario.when.forEventSource('order-1').events(new ShipmentSent('T-1'), new ShipmentDelivered('Jane'), new ShipmentLost('weather'));
    });

    it('should call the batch method once', () => batches.length.should.equal(1));
    it('should give it the events it observes, in sequence order', () =>
        batches[0].batch.events.map(event => event.eventType).should.deep.equal([ShipmentSent, ShipmentLost]));
    it('should give it the content of the events', () =>
        (batches[0].batch.ofType(ShipmentSent)[0].event as unknown as ShipmentSent).trackingNumber.should.equal('T-1'));
    it('should describe the page as live', () => batches[0].context.origin.should.equal(ObservationOrigin.Live));
    it('should describe every event of the page', () => batches[0].context.eventCount.should.equal(3));
    it('should allow deferring', () => batches[0].context.canDefer.should.be.true);
    it('should give each event its delivery identity', () => batches[0].batch.events.every(event => event.delivery !== undefined).should.be.true);
    it('should still call the per-event method for the other events', () => delivered.should.deep.equal(['Jane']));
    it('should report every event as handled', () => scenario.results[0].handled.length.should.equal(3));
    it('should report no partition outcomes', () => scenario.partitionOutcomes.should.be.empty);
});

describe('when a page of several event sources reaches a batch method', () => {
    let scenario: ReactorScenario;
    beforeEach(async () => {
        reset();
        scenario = new ReactorScenario(Shipments, options);
        await scenario.given.page(
            { eventSourceId: 'order-1', event: new ShipmentSent('T-1') },
            { eventSourceId: 'order-2', event: new ShipmentSent('T-2') });
        await scenario.when.page(
            { eventSourceId: 'order-3', event: new ShipmentSent('T-3') },
            { eventSourceId: 'order-4', event: new ShipmentLost('customs') },
            { eventSourceId: 'order-3', event: new ShipmentLost('weather') });
    });

    it('should call the batch method once per page', () => batches.length.should.equal(2));
    it('should give the given page as one batch', () => batches[0].batch.partitions.should.deep.equal(['order-1', 'order-2']));
    it('should give the action page as one batch', () => batches[1].batch.length.should.equal(3));
    it('should list the partitions of the page in order', () => batches[1].context.partitions.should.deep.equal(['order-3', 'order-4']));
    it('should report the partitions of the delivery', () => scenario.results[1].partitions.should.deep.equal(['order-3', 'order-4']));
});

describe('when a batch method fails and defers partitions', () => {
    let scenario: ReactorScenario;
    beforeEach(async () => {
        reset();
        failing = 'order-1';
        deferring = 'order-2';
        scenario = new ReactorScenario(Shipments, options);
        await scenario.when.page(
            { eventSourceId: 'order-1', event: new ShipmentSent('T-1') },
            { eventSourceId: 'order-2', event: new ShipmentSent('T-2') },
            { eventSourceId: 'order-3', event: new ShipmentSent('T-3') });
    });

    it('should assert the failed partition', () => scenario.shouldHaveFailed('order-1'));
    it('should assert the deferred partition', () => scenario.shouldHaveDeferred('order-2'));
    it('should refuse to assert a partition that succeeded as failed', () =>
        (() => scenario.shouldHaveFailed('order-3')).should.throw(/order-3.*failed 'order-1', deferred 'order-2'/));
    it('should refuse to assert a failed partition as deferred', () => (() => scenario.shouldHaveDeferred('order-1')).should.throw());
    it('should keep the outcomes in the order they were reported', () =>
        scenario.partitionOutcomes.map(outcome => [outcome.partition, outcome.kind, outcome.methodName]).should.deep.equal([
            ['order-1', BatchOutcomeKind.Failed, 'track'], ['order-2', BatchOutcomeKind.Deferred, 'track']]));
    it('should keep the delay of the deferral', () => scenario.partitionOutcomes[1].retryAfterMilliseconds.should.equal(1000));
    it('should keep the error of the failure', () => (scenario.partitionOutcomes[0].error as Error).message.should.equal('unknown carrier'));
    it('should report only the other partition as handled', () =>
        scenario.results[0].handled.map(context => context.eventSourceId).should.deep.equal(['order-3']));
    it('should complete the delivery', () => scenario.results[0].completed.should.be.true);
    it('should offer the outcomes on the assertion view', () => scenario.then.partitionOutcomes.length.should.equal(2));
});

describe('when a batch method throws', () => {
    let scenario: ReactorScenario;
    let error: unknown;
    beforeEach(async () => {
        reset();
        throwing = true;
        scenario = new ReactorScenario(Shipments, options);
        error = await scenario.when.forEventSource('order-1').events(new ShipmentSent('T-1')).catch(caught => caught);
    });

    it('should reject the call that delivered the events', () => (error as Error).message.should.equal('tracking service is down'));
    it('should report the delivery as not completed', () => scenario.results[0].completed.should.be.false);
});

describe('when a batch method returns a value', () => {
    let error: unknown;
    beforeEach(async () => {
        @reactor('scenario-batch-returning')
        class Returning {
            @observes(ShipmentSent)
            track() { return 'done'; }
        }
        const scenario = new ReactorScenario(Returning, options);
        error = await scenario.when.forEventSource('order-1').events(new ShipmentSent('T-1')).catch(caught => caught);
    });

    it('should reject the delivery', () => error!.should.be.instanceOf(BatchMethodReturnedAValue));
});
