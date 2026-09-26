// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { buildReadModelDefinition } from '../readModels/buildReadModelDefinition.js';

/** Connection-independent contracts and schemas produced for projection registration. */
export interface CompiledProjectionDefinitions {
    /** The final wire definitions, including variant cross-wiring and LastUpdated hashes. */
    readonly definitions: ProjectionDefinition[];
    /** Read models registered before the projections. */
    readonly readModels: ReturnType<typeof buildReadModelDefinition>[];
    /** Event schemas keyed by event type identifier and generation, as registered by EventTypes. */
    readonly eventSchemas: ReadonlyMap<string, string>;
    /** Optional declaration origin by projection identifier and contract path (not part of the wire payload). */
    readonly provenance?: ReadonlyMap<string, ReadonlyMap<string, string>>;
}
