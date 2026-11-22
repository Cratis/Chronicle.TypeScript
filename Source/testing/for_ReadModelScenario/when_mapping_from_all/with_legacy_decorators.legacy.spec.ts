// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, it } from 'vitest';
import { ProjectionDefinitionCompiler } from '../../../projections/ProjectionDefinitionCompiler.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { fromAllEvents } from '../../../projections/modelBound/fromAllEvents.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { Created, Renamed, Removed, artifacts } from './given/compiled_projection.js';
import { assertOracleInput } from './given/oracle_input.js';
import { assertLifecycle } from './given/lifecycle.js';

@removedWith(Removed)
class Model {
    @field(String) id!: string;
    @field(String) @setFrom(Created, 'name') @setFrom(Renamed, 'name') name!: string;
    @field(String) @fromAllEvents(undefined, 'sequenceNumber') lastSequence!: string;
}
const modelArtifacts = { ...artifacts, readModels: [Model], projections: [] };
export const candidate = {
    name: 'from-all-legacy', model: Model, artifacts: modelArtifacts,
    compile: () => new ProjectionDefinitionCompiler(modelArtifacts, 'test').compile([], [Model])
};
describe('when mapping from all events through legacy decorators', () => {
    it('should compile exactly the oracle input', () => assertOracleInput(candidate));
    it('should handle undeclared events and preserve independent roots and recreation', async () => {
        await assertLifecycle(new ReadModelScenario(Model, modelArtifacts));
    });
});
