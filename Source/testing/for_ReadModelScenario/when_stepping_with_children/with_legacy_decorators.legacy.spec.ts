// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { ProjectionDefinitionCompiler } from '../../../projections/ProjectionDefinitionCompiler.js';
import { increment } from '../../../projections/modelBound/increment.js';
import { decrement } from '../../../projections/modelBound/decrement.js';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { Stepped, ItemChanged, ItemRemoved, Removed, variants, type Operation } from './given/compiled_projection.js';
import { lifecycle } from './given/lifecycle.js';
import { assertOracleInput } from './given/oracle_input.js';

chai.should();
function candidateFor(operation: Operation) {
    const step = operation === 'increment' ? increment : decrement;
    @removedWith(ItemRemoved, 'itemId')
    class Item {
        @field(String) itemId!: string;
        @field(String) name!: string;
    }
    @removedWith(Removed)
    class Totals {
        @field(String) id!: string;
        @field(Number) @step(Stepped) total!: number;
        @field(Array) @childrenFrom(ItemChanged, { childType: Item, key: 'itemId', identifiedBy: 'itemId' }) items!: Item[];
    }
    const artifacts = { ...variants[0].artifacts, projections: [], readModels: [Totals] };
    return {
        name: `${operation}-children-legacy`, operation, event: Stepped, model: Totals, artifacts,
        compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile([], [Totals])
    };
}
export const candidates = [candidateFor('increment'), candidateFor('decrement')];
for (const candidate of candidates) {
    describe(`when applying ${candidate.operation} with independent children through legacy decorators`, () => {
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
