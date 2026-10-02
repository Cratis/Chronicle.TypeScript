// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it, type Assertion } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { addFrom } from '../../../projections/modelBound/addFrom.js';
import { subtractFrom } from '../../../projections/modelBound/subtractFrom.js';
import { count } from '../../../projections/modelBound/count.js';
import { increment } from '../../../projections/modelBound/increment.js';
import { decrement } from '../../../projections/modelBound/decrement.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

@eventType('standard-arithmetic-added')
class Added {
    @field(Number) amount: number;
    @field(String) title = 'not mapped';
    constructor(amount: number) { this.amount = amount; }
}
@eventType('standard-arithmetic-subtracted')
class Subtracted {
    @field(Number) amount: number;
    constructor(amount: number) { this.amount = amount; }
}
@eventType('standard-arithmetic-renamed')
class Renamed {
    @field(Number) amount = 1;
    @field(String) caption = 'explicit';
    @field(String) title = 'automapped';
}
class Totals {
    @field(String) id = '';
    @field(Number) @addFrom(Added, 'amount') @subtractFrom(Subtracted, 'amount') @addFrom(Renamed, 'amount') total = 0;
    @field(Number) @addFrom(Added) @subtractFrom(Subtracted) amount = 0;
    @field(Number) @count(Added) counted = 0;
    @field(Number) @increment(Added) incremented = 0;
    @field(Number) @decrement(Added) decremented = 0;
    @field(String) @setFrom(Renamed, 'caption') label = '';
    @field(String) title = '';
}
const artifacts = { eventTypes: [Added, Subtracted, Renamed], readModels: [Totals], reducers: [], projections: [] };

// The same operations are captured in arithmetic.json, arithmetic-numeric-matrix.json and arithmetic-automap.json.
describe('when evaluating arithmetic with standard model-bound decorators', () => {
    it('should accumulate all five operations and default event property names', async () => {
        const scenario = new ReadModelScenario(Totals, artifacts);
        scenario.given.forEventSource('A').events(new Added(2.5), new Added(3), new Subtracted(1));
        const result = (await scenario.instance)!;
        should([result.total, result.amount, result.counted, result.incremented, result.decremented]).deep.equal([4.5, 4.5, 2, 2, -2]);
    });

    it('should replay additional seeds without counting the previous replay twice and keep sources independent', async () => {
        const scenario = new ReadModelScenario(Totals, artifacts);
        scenario.given.forEventSource('A').events(new Added(2));
        should((await scenario.instance)!.total).equal(2);
        scenario.given.forEventSource('B').events(new Added(7));
        scenario.given.forEventSource('A').events(new Added(3));
        should((await scenario.instanceForEventSourceId('A'))!.total).equal(5);
        should((await scenario.instanceForEventSourceId('B'))!.total).equal(7);
    });

    it('should suppress aggregate-only AutoMap and restore it for mixed mappings', async () => {
        const scenario = new ReadModelScenario(Totals, artifacts);
        scenario.given.forEventSource('A').events(new Added(2));
        should((await scenario.instance)!.title === undefined).be.true;
        scenario.given.forEventSource('A').events(new Renamed());
        const result = (await scenario.instance)!;
        should([result.total, result.title, result.label]).deep.equal([3, 'automapped', 'explicit']);
    });
});
