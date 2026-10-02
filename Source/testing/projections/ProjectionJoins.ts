// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ProjectionJoinRecord } from './ProjectionJoinRecord.js';

/** The kernel's join AutoMap differs from From: explicitly consumed sources are not mapped again. */
export class ProjectionJoins {
    /** Builds the effective root join mappings, including inherited settings and exclusions. */
    static properties(definition: ProjectionDefinition, eventSchema: JsonSchema, modelSchema: JsonSchema): Record<string, string> {
        const join = (definition.Join[0] as ProjectionJoinRecord).Value;
        const properties = { ...join.Properties };
        const autoMap = (join.AutoMap ?? AutoMap.Inherit) === AutoMap.Inherit ? definition.AutoMap : join.AutoMap;
        if (autoMap === AutoMap.Disabled) return properties;
        const destinations = new Set(Object.keys(properties).map(name => name.toLowerCase()));
        const sources = new Set(Object.values(properties).map(name => name.toLowerCase()));
        const exclusions = new Set((definition.NoAutoMapProperties ?? []).map(name => name.toLowerCase()));
        for (const source of Object.keys(eventSchema.properties ?? {})) {
            if (destinations.has(source.toLowerCase()) || sources.has(source.toLowerCase())) continue;
            const destination = Object.keys(modelSchema.properties ?? {}).find(name => name.toLowerCase() === source.toLowerCase());
            if (destination && !exclusions.has(destination.toLowerCase())) {
                properties[destination] = source;
                destinations.add(destination.toLowerCase());
                sources.add(source.toLowerCase());
            }
        }
        return properties;
    }
}
