// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { chai, describe, it } from 'vitest';
import { eventType } from '../events/eventTypeDecorator.js';
import { childrenFrom } from '../projections/modelBound/childrenFrom.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { setFrom } from '../projections/modelBound/setFrom.js';
import { JsonSchemaGenerator } from '../schemas/JsonSchemaGenerator.js';
import { ReadModelScenario, UnsupportedProjectionOperation } from './index.js';

chai.should();

class ScenarioItemAdded {
    constructor(public itemId = '', public name = '') {}
}
eventType('scenario-keyed-item-added')(ScenarioItemAdded);

class ScenarioItem {
    id = '';
    name = '';
}

class ScenarioOrder {
    id = '';
    items: ScenarioItem[] = [];
}
childrenFrom(ScenarioItemAdded, { childType: ScenarioItem, key: 'itemId' })(ScenarioOrder.prototype, 'items');
fromEvent(ScenarioItemAdded)(ScenarioOrder);

class ScenarioKeyedItem {
    itemId = '';
    name = '';
}

class ScenarioKeyedOrder {
    id = '';
    items: ScenarioKeyedItem[] = [];
}
childrenFrom(ScenarioItemAdded, { childType: ScenarioKeyedItem, key: 'itemId' })(ScenarioKeyedOrder.prototype, 'items');
fromEvent(ScenarioItemAdded)(ScenarioKeyedOrder);

class ScenarioNamedItem {
    id = '';
    name = '';
}
setFrom(ScenarioItemAdded, 'name')(ScenarioNamedItem.prototype, 'name');

class ScenarioNamedOrder {
    id = '';
    items: ScenarioNamedItem[] = [];
}
childrenFrom(ScenarioItemAdded, { childType: ScenarioNamedItem, key: 'itemId' })(ScenarioNamedOrder.prototype, 'items');
fromEvent(ScenarioItemAdded)(ScenarioNamedOrder);

class ScenarioUnknownOrder {
    id = '';
    items: ScenarioItem[] = [];
}
childrenFrom(ScenarioItemAdded, { key: 'itemId', identifiedBy: 'id' })(ScenarioUnknownOrder.prototype, 'items');
fromEvent(ScenarioItemAdded)(ScenarioUnknownOrder);

class ScenarioUnresolvedItem {
    id!: string;
    name!: string;
}

class ScenarioUnresolvedOrder {
    id = '';
    items: ScenarioUnresolvedItem[] = [];
}
childrenFrom(ScenarioItemAdded, { childType: ScenarioUnresolvedItem, key: 'itemId', identifiedBy: 'id' })(ScenarioUnresolvedOrder.prototype, 'items');
fromEvent(ScenarioItemAdded)(ScenarioUnresolvedOrder);

const artifacts = { eventTypes: [ScenarioItemAdded], reducers: [], projections: [] };

describe('when a read model scenario evaluates keyed children from the options form', () => {
    it('should add one child per key and update an existing child in place (children-typed-items)', async () => {
        const scenario = new ReadModelScenario(ScenarioOrder, artifacts);
        scenario.given.forEventSource('order-1').events(
            new ScenarioItemAdded('a', 'first'), new ScenarioItemAdded('b', 'second'), new ScenarioItemAdded('a', 'again'));
        const order = await scenario.instanceForEventSourceId('order-1');
        order!.id.should.equal('order-1');
        // The explicit child type registers a typed item schema, so AutoMap preserves the event's name.
        order!.items.map(item => ({ id: item.id, name: item.name })).should.deep.equal([{ id: 'a', name: 'again' }, { id: 'b', name: 'second' }]);
    });

    it('should register the same typed items schema as the oracle fixture', () => {
        const fixture = JSON.parse(readFileSync(new URL('./projections/fixtures/children-typed-items.json', import.meta.url), 'utf8'));
        JsonSchemaGenerator.generate(ScenarioOrder).properties!.items.should.deep.equal(fixture.readModel.schema.properties.items);
    });

    it('should add and update typed legacy children whose discovered identifier equals the event key (children-identifier-equals-key)', async () => {
        const fixture = JSON.parse(readFileSync(new URL('./projections/fixtures/children-identifier-equals-key.json', import.meta.url), 'utf8'));
        JsonSchemaGenerator.generate(ScenarioKeyedOrder).properties!.items.should.deep.equal(fixture.readModel.schema.properties.items);
        const scenario = new ReadModelScenario(ScenarioKeyedOrder, artifacts);
        for (let step = 0; step < 3; step++) {
            const { itemId, name } = fixture.events[step].content;
            scenario.given.forEventSource('order-1').events(new ScenarioItemAdded(itemId, name));
            const order = await scenario.instanceForEventSourceId('order-1');
            order!.should.deep.equal(fixture.expected[step].publicRead['order-1']);
        }
    });

    it('should retain only the identifier when the child type is unknown (children-untyped-items)', async () => {
        const scenario = new ReadModelScenario(ScenarioUnknownOrder, artifacts);
        scenario.given.forEventSource('order-1').events(new ScenarioItemAdded('a', 'first'));
        const order = await scenario.instanceForEventSourceId('order-1');
        order!.items.should.deep.equal([{ id: 'a' }]);
    });

    it('should retain only the identifier when the declared child members have no runtime types (children-untyped-items)', async () => {
        const fixture = JSON.parse(readFileSync(new URL('./projections/fixtures/children-untyped-items.json', import.meta.url), 'utf8'));
        JsonSchemaGenerator.generate(ScenarioUnresolvedOrder).properties!.items.should.deep.equal(fixture.readModel.schema.properties.items);
        const scenario = new ReadModelScenario(ScenarioUnresolvedOrder, artifacts);
        scenario.given.forEventSource('order-1').events(
            new ScenarioItemAdded('a', 'first'), new ScenarioItemAdded('b', 'second'), new ScenarioItemAdded('a', 'again'));
        const order = await scenario.instanceForEventSourceId('order-1');
        order!.items.map(item => ({ id: item.id, name: item.name })).should.deep.equal([{ id: 'a', name: undefined }, { id: 'b', name: undefined }]);
    });

    it('should reject explicit child property mappings', () => {
        (() => new ReadModelScenario(ScenarioNamedOrder, artifacts))
            .should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('Children.items').and.includes('explicit child property mappings');
    });
});
