// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { ProjectionScalarConverter } from './ProjectionScalarConverter.js';

/** Converts values only in the numeric and scalar schema subset admitted by ProjectionCapabilities. */
export class ProjectionValueConverter {
    /** Kernel JsonSchemaExtensions.GetDefaultValue: only nullable schemas have a null default. */
    static defaultValue(schema: JsonSchema): unknown {
        if (Array.isArray(schema.type) && schema.type.includes('null')) return null;
        if (schema.format === 'guid') return '00000000-0000-0000-0000-000000000000';
        if (schema.format === 'date-time') return '0001-01-01T00:00:00';
        if (schema.type === 'number' || schema.type === 'integer') return 0;
        if (schema.type === 'boolean') return false;
        return undefined;
    }

    /** A null exact-case value falls through to the first case-insensitive property in JSON order. */
    private static sourceKey(input: Record<string, unknown>, name: string): string | undefined {
        return Object.hasOwn(input, name) && input[name] != null
            ? name : Object.keys(input).find(key => key.toLowerCase() === name.toLowerCase());
    }

    /** The kernel deserializes event JSON against its registered schema before mapping. */
    static eventContent(content: unknown, schema: JsonSchema): Record<string, unknown> {
        const serialized = this.isObject(content) ? content : {};
        return this.properties(serialized, schema, true);
    }

    static convert(value: unknown, schema: JsonSchema, eventContent = false, expression = true): unknown {
        if (value == null) return null;
        // Concept conversion belongs to expression evaluation, never schema-bound input deserialization.
        if (expression && this.isConcept(value, schema)) {
            return this.convert(value.value, schema, eventContent, expression);
        }
        if (schema.type === 'object' && this.isObject(value)) return this.object(value, schema, eventContent);
        if (schema.type === 'array' && Array.isArray(value)) return this.array(value, schema, eventContent);
        return ProjectionScalarConverter.convert(value, schema, eventContent);
    }

    static checkNumber(number: number, schema: JsonSchema): void {
        ProjectionScalarConverter.checkNumber(number, schema);
    }

    private static isObject(value: unknown): value is Record<string, unknown> {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    private static isConcept(value: unknown, schema: JsonSchema): value is Record<string, unknown> {
        if (schema.type === 'object' || schema.type === 'array') return false;
        return this.isObject(value) && Object.keys(value).length === 1 && 'value' in value;
    }

    private static object(input: Record<string, unknown>, schema: JsonSchema, eventContent: boolean): Record<string, unknown> {
        if (schema.additionalProperties || !schema.properties) return structuredClone(input);
        return this.properties(input, schema, eventContent);
    }

    private static array(input: unknown[], schema: JsonSchema, eventContent: boolean): unknown[] {
        return input.map(item => schema.items ? this.convert(item, schema.items, eventContent, false) : structuredClone(item));
    }

    private static properties(input: Record<string, unknown>, schema: JsonSchema, eventContent: boolean): Record<string, unknown> {
        const result: Record<string, unknown> = Object.create(null);
        for (const [name, property] of Object.entries(schema.properties ?? {})) {
            const source = this.sourceKey(input, name);
            const value = source === undefined ? null : input[source];
            const converted = value == null ? this.defaultValue(property) : this.convert(value, property, eventContent, false);
            if (converted != null) result[name] = converted;
        }
        return result;
    }
}
