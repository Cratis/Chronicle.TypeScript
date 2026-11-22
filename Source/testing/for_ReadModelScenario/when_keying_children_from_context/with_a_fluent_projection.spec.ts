// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, it } from 'vitest';
import { fluent } from './given/compiled_projection.js';
import { assertOracleInput, assertOracleReads } from './given/oracle_input.js';

describe('when keying fluent children from event context', () => {
    it('should retain the exact compiler input sent to the kernel oracle', () => assertOracleInput(fluent));
    it('should match every kernel prefix and repeated public read', () => assertOracleReads(fluent));
});
