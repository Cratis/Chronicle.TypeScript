// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it, type Assertion } from 'vitest';
import { addFrom } from '../../../projections/modelBound/addFrom.js';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { Added, artifacts, ItemChanged, ItemRemoved, Removed } from './given/compiled_projection.js';
import { lifecycle } from './given/lifecycle.js';

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
    @field(Number) @addFrom(Added, 'amount') total!: number;
    @field(Array, { genericArguments: [Item] })
    @childrenFrom(ItemChanged, { key: 'itemId', identifiedBy: 'itemId' }) items!: Item[];
}

describe('when adding with independent children through standard decorators', () => {
    it('should preserve sums through child changes, removal, independent roots and parent-first recreation', async () => {
        const result = await lifecycle(new ReadModelScenario(Totals, { ...artifacts, projections: [], readModels: [Totals] }));
        should(result.first.total).equal(1.5);
        should(result.first.items).deep.equal([{ itemId: 'one', name: 'updated' }, { itemId: 'two', name: 'second' }]);
        should(result.remaining.total).equal(1.5);
        should(result.remaining.items).deep.equal([{ itemId: 'two', name: 'second' }]);
        should(result.removed === null).be.true;
        should(result.surviving).deep.equal(result.other);
        should(result.other.total).equal(8);
        should(result.recreated.total).equal(4.5);
        should(result.recreated.items).deep.equal([{ itemId: 'new', name: 'recreated' }]);
        should(result.repeated).deep.equal(result.recreated);
    });
});
