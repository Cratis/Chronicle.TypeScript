// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { buildReadModelDefinition } from '../../readModels/buildReadModelDefinition.js';

/**
 * Represents everything that is registered for a graph: the read model that describes it and the projection that fills it.
 */
export interface GraphRegistration {
    /** The name of the graph. */
    readonly graphName: string;

    /** The read model whose schema describes the graph. */
    readonly readModel: ReturnType<typeof buildReadModelDefinition>;

    /** The projection with the graph mappings. */
    readonly projection: ProjectionDefinition;
}
