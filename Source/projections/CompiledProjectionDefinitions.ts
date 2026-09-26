// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { buildReadModelDefinition } from '../readModels/buildReadModelDefinition.js';
import type { ProjectionCapabilityProvenance } from './ProjectionCapabilityProvenance.js';
import type { ProjectionEventSchema } from './ProjectionEventSchema.js';

/** Connection-independent contracts produced for projection registration. */
export interface CompiledProjectionDefinitions {
    /** The final wire definitions, including variant cross-wiring and LastUpdated hashes. */
    readonly definitions: ProjectionDefinition[];
    /** Read models registered before the projections. */
    readonly readModels: ReturnType<typeof buildReadModelDefinition>[];
    /** Pre-lowering declaration-to-contract paths, keyed by final definition identity. */
    readonly provenance: ReadonlyMap<ProjectionDefinition, readonly ProjectionCapabilityProvenance[]>;
    /** Isolated schemas for every event referenced by each definition, keyed by id:generation:tombstone. */
    readonly eventSchemas: ReadonlyMap<ProjectionDefinition, ReadonlyMap<string, ProjectionEventSchema>>;
}
