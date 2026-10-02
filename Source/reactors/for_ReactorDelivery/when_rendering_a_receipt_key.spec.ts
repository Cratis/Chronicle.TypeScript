// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ReactorDelivery } from '../index.js';

chai.should();

describe('when rendering a delivery as an application receipt key', () => {
    let delivery: ReactorDelivery;
    beforeEach(() => {
        delivery = new ReactorDelivery('Cratis.Chronicle.Reactors.for_ReactorDelivery.OrderConfirmations',
            'orders', 'default', 'event-log', 'order-42', 7n);
    });
    it('should match the .NET v19.26.2 receipt format', () => {
        delivery.id.should.equal('Cratis.Chronicle.Reactors.for_ReactorDelivery.OrderConfirmations#orders#default#event-log#order-42#7');
    });
    it('should render the same key for equal components in a new instance', () => {
        new ReactorDelivery(delivery.reactor, delivery.eventStore, delivery.namespace,
            delivery.eventSequence, delivery.partition, delivery.sequenceNumber).id.should.equal(delivery.id);
    });
    it('should preserve sequence numbers above the JavaScript safe integer range', () => {
        new ReactorDelivery('orders', 'store', 'tenant', 'event-log', 'order-42', 18446744073709551615n)
            .id.should.equal('orders#store#tenant#event-log#order-42#18446744073709551615');
    });
    it('should preserve .NET delimiter behavior without escaping or hashing', () => {
        new ReactorDelivery('orders', '', 'tenant#one', 'event-log', 'order-42', 0n)
            .id.should.equal('orders##tenant#one#event-log#order-42#0');
    });
    it('should keep the identity immutable during handling', () => {
        Object.isFrozen(delivery).should.be.true;
    });
});
