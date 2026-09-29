// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { eventType } from '../events/eventTypeDecorator.js';
import { childrenFrom } from '../projections/modelBound/childrenFrom.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { setFrom } from '../projections/modelBound/setFrom.js';
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

const artifacts = { eventTypes: [ScenarioItemAdded], reducers: [], projections: [] };

describe('when a read model scenario evaluates keyed children from the options form', () => {
    it('should add one child per key and update an existing child in place (children-untyped-items)', async () => {
        const scenario = new ReadModelScenario(ScenarioOrder, artifacts);
        scenario.given.forEventSource('order-1').events(
            new ScenarioItemAdded('a', 'first'), new ScenarioItemAdded('b', 'second'), new ScenarioItemAdded('a', 'again'));
        const order = await scenario.instanceForEventSourceId('order-1');
        order!.id.should.equal('order-1');
        // The kernel's AutoMap is schema-driven, and legacy decorators register an untyped child item schema.
        order!.items.map(item => ({ id: item.id, name: item.name })).should.deep.equal([{ id: 'a', name: '' }, { id: 'b', name: '' }]);
    });

    it('should reject child mappings into an untyped child item schema', () => {
        (() => new ReadModelScenario(ScenarioNamedOrder, artifacts))
            .should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('Children.items').and.includes('mappings into an untyped child item schema');
    });
});
