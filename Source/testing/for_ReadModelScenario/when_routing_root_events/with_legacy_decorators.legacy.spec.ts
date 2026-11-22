// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, it } from 'vitest';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { Changed, candidateFor } from './given/compiled_projection.js';
import { assertOracleInput, assertOracleReads } from './given/oracle_input.js';

@fromEvent(Changed, { key: 'targetId' })
class Model {
    @field(String) id!: string;
    @field(String) @setFrom(Changed, 'title') name!: string;
}
export const legacy = candidateFor('routed-root-legacy', Model, []);

describe('when routing legacy-decorator root events by content', () => {
    it('should retain the exact compiler input sent to the kernel oracle', () => assertOracleInput(legacy));
    it('should match every kernel prefix and repeated public read', () => assertOracleReads(legacy));
});
