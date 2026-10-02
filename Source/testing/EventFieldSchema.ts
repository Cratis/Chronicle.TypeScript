// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../schemas/JsonSchema.js';

/** Payload support is independent of the narrower, fixture-backed unique-key domain. */
export function supportsEventField(schema: JsonSchema): boolean {
    if (schema.compliance?.length || schema.security?.length || schema.enum !== undefined || schema.items !== undefined) return false;
    if (schema.type === 'object') {
        return schema.format === undefined &&
            (typeof schema.additionalProperties !== 'object' || supportsEventField(schema.additionalProperties)) &&
            Object.values(schema.properties ?? {}).every(supportsEventField);
    }
    if (schema.properties !== undefined || schema.additionalProperties !== undefined) return false;
    if (schema.type === 'string') return schema.format === undefined || ['guid', 'uuid', 'date', 'date-time'].includes(schema.format);
    if (schema.type === 'number' || schema.type === 'integer') return true;
    return schema.type === 'boolean' && schema.format === undefined;
}

/** Validate serialized JSON, never the wrapper objects production serialization has already removed. */
export function matchesEventField(value: unknown, schema: JsonSchema): boolean {
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const content = value as Record<string, unknown>;
        return (schema.required ?? []).every(key => Object.hasOwn(content, key)) &&
            Object.entries(content).every(([key, entry]) => {
                const property = schema.properties?.[key];
                if (property) return matchesEventField(entry, property);
                if (schema.additionalProperties === false) return false;
                return typeof schema.additionalProperties !== 'object' || matchesEventField(entry, schema.additionalProperties);
            });
    }
    if (schema.type === 'integer') return typeof value === 'number' && Number.isInteger(value);
    if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value);
    return typeof value === schema.type;
}
