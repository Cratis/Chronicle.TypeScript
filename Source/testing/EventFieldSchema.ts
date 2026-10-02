// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../schemas/JsonSchema.js';

const integerRanges = new Map<string, readonly [number, number]>([
    ['int8', [-128, 127]], ['uint8', [0, 255]],
    ['int16', [-32768, 32767]], ['uint16', [0, 65535]],
    ['int32', [-2147483648, 2147483647]], ['uint32', [0, 4294967295]],
    // JSON numbers cannot reliably represent the entire 64-bit domain. Fail closed outside safe integers.
    ['int64', [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]], ['uint64', [0, Number.MAX_SAFE_INTEGER]]
]);
const numberLimits = new Map<string, number>([
    ['double', Number.MAX_VALUE], ['float', 3.4028234663852886e38], ['decimal', 7.922816251426433e28]
]);

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
    if (schema.type === 'number' || schema.type === 'integer') {
        return schema.format === undefined || integerRanges.has(schema.format) ||
            (schema.type === 'number' && numberLimits.has(schema.format));
    }
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
    if (schema.type === 'integer' || schema.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) return false;
        const range = integerRanges.get(schema.format ?? '');
        if (schema.type === 'integer' || range) {
            return Number.isSafeInteger(value) && (!range || (value >= range[0] && value <= range[1]));
        }
        return Math.abs(value) <= (numberLimits.get(schema.format ?? '') ?? Number.MAX_VALUE);
    }
    if (schema.type === 'string') {
        if (typeof value !== 'string') return false;
        if (schema.format === 'guid' || schema.format === 'uuid') return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
        if (schema.format === 'date' || schema.format === 'date-time') return matchesDate(value, schema.format);
    }
    return typeof value === schema.type;
}

function matchesDate(value: string, format: string): boolean {
    const dateOnly = format === 'date';
    const pattern = dateOnly ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
    if (!pattern.test(value) || +value.slice(0, 4) < 1) return false;
    const instant = dateOnly ? `${value}T00:00:00.000Z` : value;
    if (!Number.isFinite(Date.parse(instant))) return false;
    // Date.parse rolls invalid calendar dates and 24:00 into another day; do not accept that coercion.
    return new Date(instant).toISOString().slice(0, dateOnly ? 10 : 19) === value.slice(0, dateOnly ? 10 : 19);
}
