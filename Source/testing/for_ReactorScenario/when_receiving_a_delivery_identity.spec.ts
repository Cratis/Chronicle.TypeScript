// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { EventContext as ContractEventContext, EventType as ContractEventType, ObservationState } from '@cratis/chronicle.contracts';
import type { EventContext } from '../../events/EventContext.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { ReactorDelivery, reactor, type ReactorServices } from '../../reactors/index.js';
import { deliverToReactor } from '../../reactors/for_Reactors/given/deliver_to_reactor.js';
import { ReactorScenario } from '../index.js';
import type { ClientArtifactsActivator } from '../../artifacts/ClientArtifactsActivator.js';

chai.should();

@eventType('scenario-delivery-order-placed')
class OrderPlaced {
    @field(String) readonly name: string;
    constructor(name = '') { this.name = name; }
}

for (const activated of [false, true]) {
    describe(`when a ${activated ? 'activated' : 'default'} scenario reactor receives a delivery identity`, () => {
        let scenarioDeliveries: ReactorDelivery[];
        let productionDeliveries: ReactorDelivery[];
        let contexts: EventContext[];
        let states: ObservationState[];
        beforeEach(async () => {
            let deliveries: ReactorDelivery[] = [];
            contexts = [];
            @reactor('order-confirmations')
            class OrderConfirmations {
                orderPlaced(_event: OrderPlaced, context: EventContext, services: ReactorServices, delivery: ReactorDelivery) {
                    (services.eventStore.readModels === services.readModels).should.be.true;
                    contexts.push(context);
                    deliveries.push(delivery);
                }
            }
            const activator: ClientArtifactsActivator | undefined = activated ? type => ({ instance: new type() }) : undefined;
            const scenario = new ReactorScenario(OrderConfirmations, {
                artifacts: { eventTypes: [OrderPlaced] }, constraints: 'disabled', artifactActivator: activator });
            await scenario.given.forEventSource('order-42').events(new OrderPlaced('first'));
            await scenario.when.forEventSource('order-43').events(new OrderPlaced('second'));
            scenarioDeliveries = deliveries;
            const wireContexts = contexts.map(context => ContractEventContext.fromPartial({
                EventType: ContractEventType.fromPartial({ Id: 'scenario-delivery-order-placed', Generation: 1 }),
                EventStore: context.eventStore, Namespace: context.namespace,
                EventSourceId: context.eventSourceId, SequenceNumber: context.sequenceNumber,
                ObservationState: context.observationState
            }));
            deliveries = [];
            const results = await deliverToReactor(OrderConfirmations, OrderPlaced, wireContexts, activator,
                'test-event-store', 'default');
            productionDeliveries = deliveries;
            states = results.map(result => result.Content!.Value1!.State);
        });
        it('should supply the same identity as the production observation path', () => {
            scenarioDeliveries.should.deep.equal(productionDeliveries);
            scenarioDeliveries.map(delivery => delivery.id).should.deep.equal(productionDeliveries.map(delivery => delivery.id));
            states.should.deep.equal([ObservationState.Success, ObservationState.Success]);
        });
        it('should use the fixture store, namespace, partition and committed sequence number', () => {
            scenarioDeliveries.map(delivery => delivery.id).should.deep.equal([
                'order-confirmations#test-event-store#default#event-log#order-42#0',
                'order-confirmations#test-event-store#default#event-log#order-43#1']);
        });
    });
}
