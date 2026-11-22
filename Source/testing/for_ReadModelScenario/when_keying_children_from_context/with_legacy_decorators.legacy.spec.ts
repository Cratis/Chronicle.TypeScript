// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, it } from 'vitest';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { Created, Changed, ChildRemoved, Removed, candidateFor } from './given/compiled_projection.js';
import { assertOracleInput, assertOracleReads } from './given/oracle_input.js';

@removedWith(ChildRemoved, '$eventContext(EventSourceId)')
class Item {
    @field(String) itemId!: string;
    @field(String) name!: string;
}
@removedWith(Removed)
class Model {
    @field(String) id!: string;
    @field(String) @setFrom(Created, 'title') name!: string;
    @field(Array) @childrenFrom(Changed, { childType: Item, key: '$eventContext(EventSourceId)', identifiedBy: 'itemId' }) items!: Item[];
}
const candidate = candidateFor('context-child-keys-legacy', Model, []);

describe('when keying legacy-decorator children from event context', () => {
    it('should retain the exact compiler input sent to the kernel oracle', () => assertOracleInput(candidate));
    it('should match every kernel prefix and repeated public read', () => assertOracleReads(candidate));
});
