// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { FromRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { ProjectionEventSchema } from '../../projections/ProjectionEventSchema.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';

/** Only the root, handled-event SequenceNumber mapping proven by the three public-style fixtures. */
export class ProjectionFromEveryCapabilities {
    static validate(definition: ProjectionDefinition, schema: JsonSchema,
        eventSchemas: ReadonlyMap<string, ProjectionEventSchema>, reject: ProjectionCapabilityReject): void {
        const entries = Object.entries(definition.All?.Properties ?? {});
        if (entries.length === 0) return;
        const fail = () => reject('All', 'fromEvery/all subscriptions require a kernel-backed test outside the root SequenceNumber-to-string shape');
        if (!this.isAllMapping(definition, entries, schema)) fail();
        const [target] = entries[0];
        if (!this.hasOrdinaryMappings(definition, target, schema)) fail();
        if (this.hasPayloadCollision(eventSchemas, target)) fail();
    }

    private static isAllMapping(definition: ProjectionDefinition, entries: [string, string][], schema: JsonSchema): boolean {
        if (definition.All?.AutoMap !== AutoMap.Inherit || entries.length !== 1) return false;
        if (!this.isFlatRoot(definition, schema)) return false;
        return this.isSequenceMapping(entries[0], schema);
    }

    private static isSequenceMapping([target, expression]: [string, string], schema: JsonSchema): boolean {
        return expression === '$eventContext(SequenceNumber)' && this.isStringDestination(target, schema);
    }

    private static isFlatRoot(definition: ProjectionDefinition, schema: JsonSchema): boolean {
        if (Object.keys(definition.Children ?? {}).length || definition.Join?.length) return false;
        if (!this.hasDefaultSettings(definition)) return false;
        const properties = Object.values(schema.properties ?? {});
        return properties.length === 3 && properties.every(property => this.isPlainString(property));
    }

    private static hasDefaultSettings(definition: ProjectionDefinition): boolean {
        return definition.AutoMap === AutoMap.Enabled && definition.InitialModelState === '{}' && !definition.NoAutoMapProperties?.length;
    }

    private static hasOrdinaryMappings(definition: ProjectionDefinition, target: string, schema: JsonSchema): boolean {
        const from = definition.From as unknown as FromRecord[];
        return from.length > 0 && from.every(entry => this.isOrdinaryMapping(entry, target, schema));
    }

    private static hasPayloadCollision(eventSchemas: ReadonlyMap<string, ProjectionEventSchema>, target: string): boolean {
        return [...eventSchemas.values()].some(event =>
            Object.keys(event.schema.properties ?? {}).some(name => name.toLowerCase() === target.toLowerCase()));
    }

    private static isOrdinaryMapping(entry: FromRecord, target: string, schema: JsonSchema): boolean {
        if (entry.Value.Key !== '$eventSourceId' || entry.Value.ParentKey) return false;
        const mappings = Object.entries(entry.Value.Properties ?? {});
        if (mappings.length !== 1) return false;
        const [property, expression] = mappings[0];
        return property.toLowerCase() !== target.toLowerCase() && this.isStringDestination(property, schema) &&
            /^[A-Za-z_][A-Za-z0-9_]*$/.test(expression);
    }

    private static isStringDestination(property: string, schema: JsonSchema): boolean {
        return property !== 'id' && this.isPlainString(schema.properties?.[property]);
    }

    private static isPlainString(schema: JsonSchema | undefined): boolean {
        return schema?.type === 'string' && schema.format === undefined;
    }
}
