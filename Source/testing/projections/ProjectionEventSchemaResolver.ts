// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ContractEventType } from '../../projections/declarative/ProjectionBuilderCore.js';
import { getEventTypeMapKey } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import type { ProjectionEventSchema } from '../../projections/ProjectionEventSchema.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';

/** Tracks generations across joins, roots, removals, and children in validation order. */
export class ProjectionEventSchemaResolver {
    private readonly generations = new Map<string, number>();

    constructor(private readonly catalog: ReadonlyMap<string, ProjectionEventSchema>, private readonly reject: ProjectionCapabilityReject) {}

    readonly require = (eventType: ContractEventType, path: string): JsonSchema => {
        const previous = this.generations.get(eventType.Id);
        if (previous !== undefined && previous !== eventType.Generation) this.reject(path, 'multiple generations of the same event-type id require a kernel-backed test');
        this.generations.set(eventType.Id, eventType.Generation);
        const event = this.catalog.get(getEventTypeMapKey(eventType)) ?? this.reject(path, 'participating event schema is unavailable');
        return event.schema;
    };
}
