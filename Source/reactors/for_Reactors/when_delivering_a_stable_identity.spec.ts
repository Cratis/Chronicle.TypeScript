// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventContext as ContractEventContext, EventObservationState, EventType, ObservationState } from '@cratis/chronicle.contracts';
import type { EventContext } from '../../events/EventContext.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import type { ClientArtifactsActivator } from '../../artifacts/ClientArtifactsActivator.js';
import { handles, reactor, ReactorDelivery, replay, type ReactorServices } from '../index.js';
import { deliverToReactor } from './given/deliver_to_reactor.js';

chai.should();

@eventType('delivery-order-placed')
class OrderPlaced {}

for (const activated of [false, true]) {
    describe(`when a ${activated ? 'activated' : 'default'} reactor receives a retry and replay`, () => {
        let deliveries: ReactorDelivery[];
        let states: ObservationState[];
        let contexts: EventContext[];
        let services: ReactorServices[];
        beforeEach(async () => {
            deliveries = [];
            contexts = [];
            services = [];
            @reactor('order-confirmations', 'inbox-upstream')
            class OrderConfirmations {
                @handles(OrderPlaced)
                confirm(_event: OrderPlaced, context: EventContext, reactorServices: ReactorServices, delivery: ReactorDelivery) {
                    contexts.push(context);
                    services.push(reactorServices);
                    deliveries.push(delivery);
                    if (deliveries.length === 1) throw new Error('failed after side effect');
                }
                @replay(OrderPlaced)
                restore(event: OrderPlaced, context: EventContext, reactorServices: ReactorServices, delivery: ReactorDelivery) {
                    this.confirm(event, context, reactorServices, delivery);
                }
            }
            const context = ContractEventContext.fromPartial({ EventType: EventType.fromPartial({ Id: 'delivery-order-placed', Generation: 1 }),
                EventStore: 'source-store', Namespace: 'source-tenant', EventSourceId: 'order-42',
                SequenceNumber: 9007199254740993n, ObservationState: EventObservationState.Initial });
            const activator: ClientArtifactsActivator | undefined = activated ? type => ({ instance: new type() }) : undefined;
            const results = await deliverToReactor(OrderConfirmations, OrderPlaced,
                [context, { ...context }, { ...context, ObservationState: EventObservationState.Replay }], activator);
            states = results.map(result => result.Content!.Value1!.State);
        });
        it('should preserve the identity through failed delivery, retry and a separate replay handler', () => {
            deliveries.map(delivery => delivery.id).should.deep.equal(Array(3).fill(
                'order-confirmations#source-store#source-tenant#inbox-upstream#order-42#9007199254740993'));
        });
        it('should expose all six components from the observed event and reactor', () => {
            deliveries[0].should.deep.equal(new ReactorDelivery('order-confirmations', 'source-store', 'source-tenant',
                'inbox-upstream', 'order-42', 9007199254740993n));
        });
        it('should preserve existing context and services arguments', () => {
            contexts.map(context => context.observationState).should.deep.equal([
                EventObservationState.Initial, EventObservationState.Initial, EventObservationState.Replay]);
            services.every(service => service.eventStore.readModels === service.readModels).should.be.true;
        });
        it('should still report the handler failure and subsequent successes', () => {
            states.should.deep.equal([ObservationState.Failed, ObservationState.Success, ObservationState.Success]);
        });
    });
}
