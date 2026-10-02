// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { join } from '../../../projections/modelBound/join.js';
import { noAutoMap } from '../../../projections/modelBound/noAutoMap.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../projections/UnsupportedProjectionOperation.js';

chai.should();

@eventType('standard-join-placed')
class Placed {
    @field(String) customerId: string;
    constructor(customerId: string) { this.customerId = customerId; }
}
@eventType('standard-join-named')
class Named {
    @field(String) name: string;
    @field(String) city = 'Oslo';
    @field(String) ignored = 'excluded';
    constructor(name: string) { this.name = name; }
}
@fromEvent(Placed)
class Order {
    @field(String) id = '';
    @field(String) customerId = '';
    @field(String) @join(Named, 'customerId', 'name') customerName = '';
    @field(String) name = '';
    @field(String) city = '';
    @field(String) @noAutoMap ignored = '';
}
const artifacts = { eventTypes: [Placed, Named], readModels: [Order], reducers: [], projections: [] };

// joins-automap.json captures foreign-key AutoMap, consumed-source exclusion and join AutoMap.
describe('when evaluating joins with standard model-bound decorators', () => {
    it('should backfill through the automapped foreign key and avoid mapping an explicitly consumed source twice', async () => {
        const scenario = new ReadModelScenario(Order, artifacts);
        scenario.given.forEventSource('customer').events(new Named('before'));
        scenario.given.forEventSource('A').events(new Placed('customer'));
        const result = (await scenario.instance)!;
        result.customerName.should.equal('before');
        result.city.should.equal('Oslo');
        (result.name === undefined).should.be.true;
        (result.ignored === undefined).should.be.true;
    });

    it('should fan out subsequent join events to all matching roots', async () => {
        const scenario = new ReadModelScenario(Order, artifacts);
        scenario.given.forEventSource('A').events(new Placed('customer'));
        scenario.given.forEventSource('B').events(new Placed('customer'));
        scenario.given.forEventSource('customer').events(new Named('after'));
        (await scenario.instanceForEventSourceId('A'))!.customerName.should.equal('after');
        (await scenario.instanceForEventSourceId('B'))!.customerName.should.equal('after');
    });

    it('should reject an identifier join during scenario construction', () => {
        @fromEvent(Placed)
        class Unsupported {
            @field(String) id = '';
            @field(String) @join(Named, 'id', 'name') customerName = '';
        }
        (() => new ReadModelScenario(Unsupported, { ...artifacts, readModels: [Unsupported] })).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('Join[standard-join-named:1].On (@join)').and.includes('direct non-identifier');
    });
});
