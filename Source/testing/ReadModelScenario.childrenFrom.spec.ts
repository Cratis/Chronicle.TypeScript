// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { eventType } from '../events/eventTypeDecorator.js';
import { childrenFrom } from '../projections/modelBound/childrenFrom.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { ReadModelScenario, UnsupportedProjectionOperation } from './index.js';

chai.should();

class ScenarioItemAdded {
    itemId = '';
    name = '';
}
eventType('scenario-keyed-item-added')(ScenarioItemAdded);

class ScenarioItem {
    id = '';
    name = '';
}

class ScenarioOrder {
    items: ScenarioItem[] = [];
}
childrenFrom(ScenarioItemAdded, { childType: ScenarioItem, key: 'itemId' })(ScenarioOrder.prototype, 'items');
fromEvent(ScenarioItemAdded)(ScenarioOrder);

describe('when a read model scenario evaluates keyed children from the options form', () => {
    it('should reject children projections explicitly when the scenario is created', () => {
        (() => new ReadModelScenario(ScenarioOrder, { eventTypes: [ScenarioItemAdded], reducers: [], projections: [] }))
            .should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('Children.items (@childrenFrom)').and.includes('children projections');
    });
});
