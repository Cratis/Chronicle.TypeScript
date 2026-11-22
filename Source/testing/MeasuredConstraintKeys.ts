// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

// constraints-field-key-measurements.json: exact characters, not a general Unicode/control range.
const measuredText = /^[\x00\x01\x08-\x0a\x0c\x0d\x20-\x7e\u00c9\u00df\u00e9\u00f8\u0301\u4eac\u6771]*$/;
const numericValues: Readonly<Record<string, readonly number[]>> = {
    decimal: [0.1, -1.2345, 1.2345678901234567, 0.000001],
    float: [0.1, -1.2345, 1.2345679]
};

/** Strings with measured JSON round-trip and kernel content-hash parity; never normalizes Unicode. */
export function isMeasuredText(value: string): boolean { return measuredText.test(value); }

const basicKeySchemas = new Set(['boolean/undefined', 'string/undefined', 'string/guid', 'number/undefined', 'number/double']);
type DefinitionShape = { scoped: boolean; isolated: boolean; definitions: number; ignoreCasing: boolean };

function isolatedMeasurement(options: DefinitionShape, properties: number): boolean {
    return options.isolated && !options.scoped && !options.ignoreCasing && options.definitions === 1 && properties === 1;
}

/** Existing unique-key schemas plus the isolated decimal/float measurements. */
export function supportsMeasuredKeySchema(schema: { type?: string; format?: string } | undefined,
    options: DefinitionShape, properties: number): boolean {
    if (basicKeySchemas.has(`${schema?.type}/${schema?.format}`)) return true;
    if (schema?.type !== 'number' || !isMeasuredNumericFormat(schema.format)) return false;
    return isolatedMeasurement(options, properties);
}

/** The numeric schemas measured by the raw-JSON oracle, not a promise about other values. */
export function isMeasuredNumericFormat(format: string | undefined): boolean {
    return format === 'decimal' || format === 'float';
}

/** Exact input values with matching key spelling, content and hash, in an isolated definition only. */
export function measuredNumericKey(value: unknown, format: string, name: string, enabled: boolean): string {
    const candidates = enabled ? numericValues[format] ?? [] : [];
    if (typeof value === 'number' && candidates.includes(value)) return String(value);
    throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
        `Only explicitly measured ${format} numeric key values in isolated, unscoped single-property constraints are fixture-backed.`);
}
