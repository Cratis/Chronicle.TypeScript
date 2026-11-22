// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, it } from 'vitest';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { join } from '../../../projections/modelBound/join.js';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { Placed, Named, ItemChanged, ItemRemoved, Removed, candidateFor } from './given/compiled_projection.js';
import { assertOracleInput, assertOracleReads } from './given/oracle_input.js';

@removedWith(ItemRemoved, 'itemId')
class Item {
    @field(String) itemId!: string;
    @field(String) name!: string;
}
@fromEvent(Placed)
@removedWith(Removed)
class Model {
    @field(String) id!: string;
    @field(String) @setFrom(Placed, 'customerId') customerId!: string;
    @field(String) @join(Named, 'customerId', 'name') customerName!: string;
    @field(Array, { genericArguments: [Item] })
    @childrenFrom(ItemChanged, { key: 'itemId', identifiedBy: 'itemId' }) items!: Item[];
}
export const standard = candidateFor('joins-children-standard', Model, []);

describe('when joining with independent children through standard decorators', () => {
    it('should retain the exact compiler input sent to the kernel oracle', () => assertOracleInput(standard));
    it('should match every kernel prefix and repeated public read', () => assertOracleReads(standard));
});
