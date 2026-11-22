// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it, type Assertion } from 'vitest';
import { ProjectionDefinitionCompiler } from '../../../projections/ProjectionDefinitionCompiler.js';
import { subtractFrom } from '../../../projections/modelBound/subtractFrom.js';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { Subtracted, artifacts, ItemChanged, ItemRemoved, Removed } from './given/compiled_projection.js';
import { lifecycle } from './given/lifecycle.js';
import { assertOracleInput } from './given/oracle_input.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }
@removedWith(ItemRemoved, 'itemId')
class Item {
    @field(String) itemId!: string;
    @field(String) name!: string;
}
@removedWith(Removed)
class Totals {
    @field(String) id!: string;
    @field(Number) @subtractFrom(Subtracted, 'amount') total!: number;
    @field(Array, { genericArguments: [Item] })
    @childrenFrom(ItemChanged, { key: 'itemId', identifiedBy: 'itemId' }) items!: Item[];
}
const modelArtifacts = { ...artifacts, projections: [], readModels: [Totals] };
export const candidate = {
    name: 'subtract-children-standard', event: Subtracted, model: Totals, artifacts: modelArtifacts,
    compile: () => new ProjectionDefinitionCompiler(modelArtifacts, 'test').compile([], [Totals])
};

describe('when subtracting with independent children through standard decorators', () => {
    it('should compile exactly the oracle input', () => assertOracleInput(candidate));

    it('should preserve subtraction through child changes, removal, independent roots and parent-first recreation', async () => {
        const result = await lifecycle(new ReadModelScenario(Totals, modelArtifacts));
        should(result.first.total).equal(-1.5);
        should(result.first.items).deep.equal([{ itemId: 'one', name: 'updated' }, { itemId: 'two', name: 'second' }]);
        should(result.remaining.total).equal(-1.5);
        should(result.remaining.items).deep.equal([{ itemId: 'two', name: 'second' }]);
        should(result.removed === null).be.true;
        should(result.surviving).deep.equal(result.other);
        should(result.other.total).equal(-8);
        should(result.recreated.total).equal(-4.5);
        should(result.recreated.items).deep.equal([{ itemId: 'new', name: 'recreated' }]);
        should(result.repeated).deep.equal(result.recreated);
    });
});
