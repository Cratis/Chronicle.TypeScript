// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import type { IProjectionBuilderFor } from '../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../projections/declarative/projection.js';
import { EventScenario } from '../../EventScenario.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';

chai.should();

class OrderPlaced {
    constructor(readonly customerId: string) {}
}
field(String)(OrderPlaced.prototype, 'customerId');
eventType('fluent-join-order-placed')(OrderPlaced);
class CustomerNamed {
    constructor(readonly name: string) {}
}
field(String)(CustomerNamed.prototype, 'name');
eventType('fluent-join-customer-named')(CustomerNamed);
class OrderRemoved {}
eventType('fluent-join-order-removed')(OrderRemoved);
class Order {
    id = '';
    customerId = '';
    customerName = '';
}
for (const property of ['id', 'customerId', 'customerName']) field(String)(Order.prototype, property);
class OrderProjection {
    define(builder: IProjectionBuilderFor<Order>): void {
        builder.noAutoMap()
            .from(OrderPlaced, from => from.set(model => model.customerId).to(event => event.customerId))
            .join(CustomerNamed, join => join.on(model => model.customerId).set(model => model.customerName).to(event => event.name))
            .removedWith(OrderRemoved);
    }
}
projection('fluent-join-order', Order)(OrderProjection);
const artifacts = { eventTypes: [OrderPlaced, CustomerNamed, OrderRemoved], projections: [OrderProjection], reducers: [] };

// Every ordering/lifecycle below is also captured from the packaged engine in joins-lifecycle.json.
describe('when evaluating a fluent root join', () => {
    it('should store joined history without materializing a phantom row and backfill the latest prior event', async () => {
        const scenario = new ReadModelScenario(Order, artifacts);
        scenario.given.forEventSource('customer').events(new CustomerNamed('first'), new CustomerNamed('latest'));
        (await scenario.instance === null).should.be.true;
        (await scenario.wasDeletedForEventSourceId('customer')).should.be.false;
        scenario.given.forEventSource('A').events(new OrderPlaced('customer'));
        (await scenario.instance)!.customerName.should.equal('latest');
        (await scenario.instanceForEventSourceId('customer') === null).should.be.true;
    });

    it('should update every referencing root and leave other customers unchanged', async () => {
        const scenario = new ReadModelScenario(Order, artifacts);
        scenario.given.forEventSource('A').events(new OrderPlaced('customer'));
        scenario.given.forEventSource('B').events(new OrderPlaced('customer'));
        scenario.given.forEventSource('C').events(new OrderPlaced('other'));
        (await scenario.instanceForEventSourceId('A'))!.customerId.should.equal('customer');
        scenario.given.forEventSource('customer').events(new CustomerNamed('name'));
        (await scenario.instanceForEventSourceId('A'))!.customerName.should.equal('name');
        (await scenario.instanceForEventSourceId('B'))!.customerName.should.equal('name');
        ((await scenario.instanceForEventSourceId('C'))!.customerName === undefined).should.be.true;
    });

    it('should retain joined history across removal without resurrecting the removed root', async () => {
        const scenario = new ReadModelScenario(Order, artifacts);
        scenario.given.forEventSource('A').events(new OrderPlaced('customer'), new OrderRemoved());
        scenario.given.forEventSource('customer').events(new CustomerNamed('after removal'));
        (await scenario.instance === null).should.be.true;
        (await scenario.wasDeletedForEventSourceId('A')).should.be.true;
        scenario.given.forEventSource('A').events(new OrderPlaced('customer'));
        (await scenario.instance)!.customerName.should.equal('after removal');
        (await scenario.wasDeletedForEventSourceId('A')).should.be.false;
    });

    it('should resolve a changed foreign key against its own latest history', async () => {
        const scenario = new ReadModelScenario(Order, artifacts);
        scenario.given.forEventSource('one').events(new CustomerNamed('first'));
        scenario.given.forEventSource('two').events(new CustomerNamed('second'));
        scenario.given.forEventSource('A').events(new OrderPlaced('one'));
        (await scenario.instance)!.customerName.should.equal('first');
        scenario.given.forEventSource('A').events(new OrderPlaced('two'));
        scenario.given.forEventSource('one').events(new CustomerNamed('no longer joined'));
        (await scenario.instance)!.customerName.should.equal('second');
    });

    it('should rebuild join history per replay and never share it across scenarios', async () => {
        const first = new ReadModelScenario(Order, artifacts);
        first.given.forEventSource('customer').events(new CustomerNamed('first'));
        first.given.forEventSource('A').events(new OrderPlaced('customer'));
        (await first.instance)!.customerName.should.equal('first');
        first.given.forEventSource('customer').events(new CustomerNamed('second'));
        (await first.instance)!.customerName.should.equal('second');
        const second = new ReadModelScenario(Order, artifacts);
        second.given.forEventSource('A').events(new OrderPlaced('customer'));
        ((await second.instance)!.customerName === undefined).should.be.true;
    });

    it('should update the root keys when observing a committed event sequence', async () => {
        const events = new EventScenario({ artifacts: { eventTypes: [OrderPlaced, CustomerNamed] }, constraints: 'disabled' });
        const scenario = new ReadModelScenario(Order, artifacts).observe(events);
        await events.append('A', new OrderPlaced('customer'));
        await events.append('B', new OrderPlaced('customer'));
        await events.append('customer', new CustomerNamed('joined'));
        (await scenario.instanceForEventSourceId('A'))!.customerName.should.equal('joined');
        (await scenario.instanceForEventSourceId('B'))!.customerName.should.equal('joined');
        (await scenario.instanceForEventSourceId('customer') === null).should.be.true;
    });
});
