// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChildrenDefinition } from '@cratis/chronicle.contracts';
import type { FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { ProjectionEventSchemaResolver } from './ProjectionEventSchemaResolver.js';

/** The measured intersection of one root accumulator and independent typed children. */
export class ProjectionArithmeticChildrenCapabilities {
    static supports(schema: JsonSchema, wire: Record<string, unknown>, require: ProjectionEventSchemaResolver['require']): boolean {
        const from = wire.From as FromRecord[] ?? [];
        const children = Object.entries(wire.Children as Record<string, ChildrenDefinition> ?? {});
        if (from.length !== 1 || children.length !== 1) return false;
        const mappings = Object.entries(from[0].Value.Properties ?? {});
        if (mappings.length !== 1) return false;
        const [accumulator, expression] = mappings[0];
        if (!this.accumulator(schema.properties?.[accumulator], expression, from[0], require)) return false;
        const [collection, child] = children[0];
        return this.rootShape(schema, accumulator, collection)
            && this.childShape(schema.properties?.[collection], child)
            && this.independentEvents(from, wire, child) && this.noInteractions(wire);
    }

    private static accumulator(target: JsonSchema | undefined, expression: string, from: FromRecord, require: ProjectionEventSchemaResolver['require']): boolean {
        if (expression === '$count') return this.countTarget(target);
        const operand = /^\$add\(([A-Za-z_][A-Za-z0-9]*)\)$/.exec(expression)?.[1];
        if (!operand || !this.unformattedNumber(target)) return false;
        const event = require(from.Key, eventContractPath('From', from.Key));
        return this.unformattedNumber(event.properties?.[operand]);
    }

    private static unformattedNumber(schema?: JsonSchema): boolean {
        return schema?.type === 'number' && schema.format === undefined;
    }

    private static rootShape(schema: JsonSchema, count: string, collection: string): boolean {
        const properties = schema.properties ?? {};
        return this.exactRootMembers(properties, count, collection)
            && this.plainString(properties.id);
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
