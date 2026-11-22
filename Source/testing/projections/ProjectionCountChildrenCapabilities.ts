// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChildrenDefinition } from '@cratis/chronicle.contracts';
import type { FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';

/** The measured intersection of root counting and independent typed children. */
export class ProjectionCountChildrenCapabilities {
    static supports(schema: JsonSchema, wire: Record<string, unknown>): boolean {
        const from = wire.From as FromRecord[] ?? [];
        const children = Object.entries(wire.Children as Record<string, ChildrenDefinition> ?? {});
        if (!this.singleCount(from) || children.length !== 1) return false;
        const [collection, child] = children[0];
        const count = Object.keys(from[0].Value.Properties)[0];
        return this.rootShape(schema, count, collection)
            && this.childShape(schema.properties?.[collection], child)
            && this.independentEvents(from, wire, child) && this.noInteractions(wire);
    }

    private static singleCount(from: FromRecord[]): boolean {
        if (from.length !== 1) return false;
        const expressions = Object.values(from[0].Value.Properties ?? {});
        return expressions.length === 1 && expressions[0] === '$count';
    }

    private static rootShape(schema: JsonSchema, count: string, collection: string): boolean {
        const properties = schema.properties ?? {};
        return this.exactRootMembers(properties, count, collection)
            && this.plainString(properties.id) && this.countTarget(properties[count]);
    }

    private static exactRootMembers(properties: Record<string, JsonSchema>, count: string, collection: string): boolean {
        const allowed = new Set(['id', count, collection]);
        const names = Object.keys(properties);
        return allowed.size === 3 && names.length === 3 && names.every(property => allowed.has(property));
    }

    private static countTarget(schema?: JsonSchema): boolean {
        return schema?.type === 'number' && [undefined, '', 'double'].includes(schema.format);
    }

    private static plainString(schema?: JsonSchema): boolean {
        return schema?.type === 'string' && !schema.format;
    }

    private static childShape(collection: JsonSchema | undefined, child: ChildrenDefinition): boolean {
        return collection?.type === 'array' && this.stringItems(collection.items, child.IdentifiedBy)
            && child.From.length > 0 && child.Join.length === 0;
    }

    private static stringItems(items: JsonSchema | undefined, identifier: string): boolean {
        if (items?.type !== 'object' || !items.properties) return false;
        return this.plainString(items.properties[identifier])
            && Object.values(items.properties).every(property => this.plainString(property));
    }

    private static independentEvents(from: FromRecord[], wire: Record<string, unknown>, child: ChildrenDefinition): boolean {
        const removals = wire.RemovedWith as RemovedWithRecord[] ?? [];
        const rootEvents = new Set([...from, ...removals].map(entry => entry.Key.Id));
        return [...child.From, ...child.RemovedWith].every(entry => {
            if (!entry.Key) return false;
            return !rootEvents.has(entry.Key.Id);
        });
    }

    private static noInteractions(wire: Record<string, unknown>): boolean {
        return (wire.InitialModelState ?? '{}') === '{}'
            && (wire.Join as unknown[] ?? []).length === 0;
    }
}
