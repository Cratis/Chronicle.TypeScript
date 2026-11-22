// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, it } from 'vitest';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { candidate } from './given/compiled_projection.js';
import { assertOracleInput } from './given/oracle_input.js';
import { assertLifecycle } from './given/lifecycle.js';

describe('when mapping from every handled event through a fluent projection', () => {
    it('should compile exactly the oracle input', () => assertOracleInput(candidate));
    it('should update context only for handled events and preserve independent roots and recreation', async () => {
        await assertLifecycle(new ReadModelScenario(candidate.model, candidate.artifacts));
    });
});
