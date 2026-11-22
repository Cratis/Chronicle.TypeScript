// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { beforeAll, chai, describe, it } from 'vitest';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { count } from '../../../projections/modelBound/count.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { Counted, ItemChanged, ItemRemoved, Removed } from './given/compiled_projection.js';
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
    @field(Number) @count(Counted) total!: number;
    @field(Array) @childrenFrom(ItemChanged, { childType: Item, key: 'itemId', identifiedBy: 'itemId' })
    items!: Item[];
}
const artifacts = { eventTypes: [Counted, ItemChanged, ItemRemoved, Removed], readModels: [Totals], reducers: [], projections: [] };

describe('when counting a parent with legacy-decorator children and no initial values', () => {
    let result: Awaited<ReturnType<typeof lifecycle<Totals>>>;
    beforeAll(async () => { result = await lifecycle(new ReadModelScenario(Totals, artifacts)); });
    it('should count root events without assigning their same-named payload', () => result.first.total.should.equal(3));
    it('should update children without changing the root count', () => result.first.items.should.deep.equal([
        { itemId: 'one', name: 'updated' }, { itemId: 'two', name: 'second' }
    ]));
    it('should remove only the matching child and ignore unknown children', () => result.remaining.items.should.deep.equal([{ itemId: 'two', name: 'second' }]));
    it('should leave the other parent independent', () => [result.other.total, result.surviving.id, result.removed].should.deep.equal([1, 'B', null]));
    it('should discard old children and count on root recreation', () => [result.recreated.total, result.recreated.items].should.deep.equal([1, [{ itemId: 'new', name: 'recreated' }]]));
    it('should not count an unchanged repeated read twice', () => result.repeated.should.deep.equal(result.recreated));
});
