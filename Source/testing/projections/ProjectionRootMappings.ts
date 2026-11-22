// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { FromRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import { ProjectionArithmetic } from './ProjectionArithmetic.js';

/** Composes mappings for an already-subscribed root event without changing subscriptions. */
export class ProjectionRootMappings {
    static explicit(definition: ProjectionDefinition, from: FromRecord): Record<string, string> {
        return { ...definition.All?.Properties, ...from.Value.Properties };
    }

    static usesAutoMap(definition: ProjectionDefinition, explicit: Record<string, string>): boolean {
        return definition.AutoMap !== AutoMap.Disabled && !ProjectionArithmetic.suppressesAutoMap(explicit);
    }
}
