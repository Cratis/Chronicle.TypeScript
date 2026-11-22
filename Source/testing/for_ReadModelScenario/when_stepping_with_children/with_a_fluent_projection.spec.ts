// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { variants } from './given/compiled_projection.js';
import { lifecycle } from './given/lifecycle.js';
import { assertOracleInput } from './given/oracle_input.js';

chai.should();
for (const candidate of variants) {
    describe(`when applying ${candidate.operation} with independent children through a fluent projection`, () => {
        it('should compile exactly the oracle input', () => assertOracleInput(candidate));

        it('should step once per root event, ignore payloads and preserve independent children and recreation', async () => {
            const direction = candidate.operation === 'increment' ? 1 : -1;
            const result = await lifecycle(new ReadModelScenario(candidate.model, candidate.artifacts));
            result.first.total.should.equal(3 * direction);
            result.first.items.should.deep.equal([{ itemId: 'one', name: 'updated' }, { itemId: 'two', name: 'second' }]);
            result.remaining.total.should.equal(3 * direction);
            result.remaining.items.should.deep.equal([{ itemId: 'two', name: 'second' }]);
            (result.removed === null).should.be.true;
            result.surviving.should.deep.equal(result.other);
            result.other.total.should.equal(direction);
            result.recreated.total.should.equal(direction);
            result.recreated.items.should.deep.equal([{ itemId: 'new', name: 'recreated' }]);
            result.repeated.should.deep.equal(result.recreated);
        });
    });
}
