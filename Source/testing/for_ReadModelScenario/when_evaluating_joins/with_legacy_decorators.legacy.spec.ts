// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { join } from '../../../projections/modelBound/join.js';
import { noAutoMap } from '../../../projections/modelBound/noAutoMap.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';

chai.should();

@eventType('legacy-join-placed')
class Placed {
    @field(String) customerId: string;
    constructor(customerId: string) { this.customerId = customerId; }
}
@eventType('legacy-join-named')
class Named {
    @field(String) name: string;
    @field(String) city = 'Oslo';
    @field(String) ignored = 'excluded';
    constructor(name: string) { this.name = name; }
}
@eventType('legacy-join-removed')
class Removed {}
@fromEvent(Placed)
@removedWith(Removed)
class Order {
    @field(String) id = '';
    @field(String) customerId = '';
    @field(String) @join(Named, 'customerId', 'name') customerName = '';
    @field(String) name = '';
    @field(String) city = '';
    @field(String) @noAutoMap ignored = '';
}
const artifacts = { eventTypes: [Placed, Named, Removed], readModels: [Order], reducers: [], projections: [] };

describe('when evaluating joins with legacy model-bound decorators', () => {
    it('should backfill and automap joined values without mapping an explicitly consumed source twice', async () => {
        const scenario = new ReadModelScenario(Order, artifacts);
        scenario.given.forEventSource('customer').events(new Named('before'));
        scenario.given.forEventSource('A').events(new Placed('customer'));
        const result = (await scenario.instance)!;
        result.customerName.should.equal('before');
        result.city.should.equal('Oslo');
        (result.name === undefined).should.be.true;
        (result.ignored === undefined).should.be.true;
    });

    it('should update existing roots and recreate a removed root from the latest joined history', async () => {
        const scenario = new ReadModelScenario(Order, artifacts);
        scenario.given.forEventSource('A').events(new Placed('customer'));
        scenario.given.forEventSource('B').events(new Placed('customer'));
        scenario.given.forEventSource('customer').events(new Named('first'));
        (await scenario.instanceForEventSourceId('A'))!.customerName.should.equal('first');
        scenario.given.forEventSource('A').events(new Removed());
        scenario.given.forEventSource('customer').events(new Named('second'));
        (await scenario.wasDeletedForEventSourceId('A')).should.be.true;
        (await scenario.instanceForEventSourceId('B'))!.customerName.should.equal('second');
        scenario.given.forEventSource('A').events(new Placed('customer'));
        (await scenario.instanceForEventSourceId('A'))!.customerName.should.equal('second');
        (await scenario.wasDeletedForEventSourceId('A')).should.be.false;
    });
});
