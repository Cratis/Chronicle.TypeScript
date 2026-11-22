// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { addFrom } from '../../../projections/modelBound/addFrom.js';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { Added, artifacts, ItemChanged, ItemRemoved, Removed } from './given/compiled_projection.js';
import { lifecycle } from './given/lifecycle.js';

chai.should();
@removedWith(ItemRemoved, 'itemId')
class Item {
    @field(String) itemId!: string;
    @field(String) name!: string;
}
@removedWith(Removed)
class Totals {
    @field(String) id!: string;
    @field(Number) @addFrom(Added, 'amount') total!: number;
    @field(Array) @childrenFrom(ItemChanged, { childType: Item, key: 'itemId', identifiedBy: 'itemId' })
    items!: Item[];
}

describe('when adding with independent children through legacy decorators', () => {
    it('should preserve sums through child changes, removal, independent roots and parent-first recreation', async () => {
        const result = await lifecycle(new ReadModelScenario(Totals, { ...artifacts, projections: [], readModels: [Totals] }));
        result.first.total.should.equal(1.5);
        result.first.items.should.deep.equal([{ itemId: 'one', name: 'updated' }, { itemId: 'two', name: 'second' }]);
        result.remaining.total.should.equal(1.5);
        result.remaining.items.should.deep.equal([{ itemId: 'two', name: 'second' }]);
        (result.removed === null).should.be.true;
        result.surviving.should.deep.equal(result.other);
        result.other.total.should.equal(8);
        result.recreated.total.should.equal(4.5);
        result.recreated.items.should.deep.equal([{ itemId: 'new', name: 'recreated' }]);
        result.repeated.should.deep.equal(result.recreated);
    });
});
