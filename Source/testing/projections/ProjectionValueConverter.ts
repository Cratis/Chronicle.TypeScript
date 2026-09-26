// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';

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

    /** The kernel deserializes event JSON against its registered schema before mapping. */
    static eventContent(content: unknown, schema: JsonSchema): Record<string, unknown> {
        const serialized = content !== null && typeof content === 'object' && !Array.isArray(content)
            ? content as Record<string, unknown> : {};
        const result: Record<string, unknown> = Object.create(null);
        for (const [name, property] of Object.entries(schema.properties ?? {})) {
            const source = Object.keys(serialized).find(key => key.toLowerCase() === name.toLowerCase());
            const value = source === undefined ? null : serialized[source];
            if (value !== null && value !== undefined) result[name] = this.convert(value, property, true, false);
            else {
                const fallback = this.defaultValue(property);
                if (fallback !== null && fallback !== undefined) result[name] = fallback;
            }
        }
        return result;
    }

    static convert(value: unknown, schema: JsonSchema, eventContent = false, expression = true): unknown {
        if (value == null) return null;
        // Concept conversion belongs to expression evaluation, never schema-bound input deserialization.
        if (expression && schema.type !== 'object' && schema.type !== 'array' &&
            typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && 'value' in value) {
            return this.convert((value as Record<string, unknown>).value, schema, eventContent, expression);
        }
        if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
            const input = value as Record<string, unknown>;
            if (schema.additionalProperties || !schema.properties) return structuredClone(input);
            const result: Record<string, unknown> = Object.create(null);
            for (const [name, property] of Object.entries(schema.properties)) {
                const source = Object.keys(input).find(key => key.toLowerCase() === name.toLowerCase());
                if (source !== undefined && input[source] != null) result[name] = this.convert(input[source], property, eventContent, false);
                else {
                    const fallback = this.defaultValue(property);
                    if (fallback !== null && fallback !== undefined) result[name] = fallback;
                }
            }
            return result;
        }
        if (schema.type === 'array' && Array.isArray(value)) {
            return value.map(item => schema.items ? this.convert(item, schema.items, eventContent, false) : structuredClone(item));
        }
        if (schema.type === 'boolean' && typeof value === 'string' && /^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
        if (schema.type === 'number' || schema.type === 'integer') {
            if (eventContent && typeof value !== 'number') {
                throw new RangeError(`Projection event numeric value '${String(value)}' must be a JSON number.`);
            }
            if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))) {
                throw new RangeError(`Projection numeric value '${String(value)}' is not supported by ${schema.type}/${schema.format ?? 'double'}.`);
            }
            const number = typeof value === 'number' ? value : Number(value);
            this.checkNumber(number, schema);
            return number;
        }
        if (schema.format === 'guid' && typeof value === 'string') return value.toLowerCase();
        if (schema.type === 'string' && typeof value !== 'string') return String(value);
        return value;
    }

    static checkNumber(number: number, schema: JsonSchema): void {
        if (!Number.isFinite(number) || (schema.type === 'integer' && (!Number.isSafeInteger(number) ||
            (schema.format === 'int32' && (number < -2147483648 || number > 2147483647)) ||
            (schema.format === 'uint32' && (number < 0 || number > 4294967295))))) {
            throw new RangeError(`Projection numeric value '${number}' is outside the supported ${schema.type}/${schema.format ?? 'double'} range.`);
        }
    }
}
