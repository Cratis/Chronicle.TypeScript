// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { artifacts, Totals, variants } from './given/compiled_projection.js';
import { history, lifecycle } from './given/lifecycle.js';
import { assertOracleInput } from './given/oracle_input.js';

chai.should();
describe('when subtracting with independent children through a fluent projection', () => {
    for (const variant of variants) {
        it(`should compile exactly the oracle input for ${variant.name}`, () => assertOracleInput(variant));
    }

    it('should subtract fractions, negative and zero values independently of child updates and removals', async () => {
        const result = await lifecycle(new ReadModelScenario(Totals, artifacts));
        result.first.total.should.equal(-1.5);
        result.first.items.should.deep.equal([{ itemId: 'one', name: 'updated' }, { itemId: 'two', name: 'second' }]);
        result.remaining.total.should.equal(-1.5);
        result.remaining.items.should.deep.equal([{ itemId: 'two', name: 'second' }]);
        (result.removed === null).should.be.true;
        result.surviving.should.deep.equal(result.other);
        result.other.total.should.equal(-8);
        result.recreated.total.should.equal(-4.5);
        result.recreated.items.should.deep.equal([{ itemId: 'new', name: 'recreated' }]);
        result.repeated.should.deep.equal(result.recreated);
    });

    for (const variant of variants.slice(1)) {
        it(`should subtract rather than assign for ${variant.name}`, async () => {
            const scenario = new ReadModelScenario(Totals, variant.artifacts);
            for (const { source, event } of history(amount => new variant.event(amount)).slice(0, 8)) {
                scenario.given.forEventSource(source).events(event);
            }
            (await scenario.instanceForEventSourceId('A'))!.total.should.equal(-1.5);
            (await scenario.instanceForEventSourceId('B'))!.total.should.equal(-8);
        });
    }
});
