// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';

/** Scalar conversions shared by schema-bound input and expression evaluation. */
export class ProjectionScalarConverter {
    static convert(value: unknown, schema: JsonSchema, eventContent: boolean): unknown {
        if (schema.type === 'boolean') return this.boolean(value, eventContent);
        if (schema.type === 'number' || schema.type === 'integer') return this.number(value, schema, eventContent);
        if (schema.format === 'date-time') return this.dateTime(value);
        return this.schemaString(value, schema, eventContent);
    }

    static checkNumber(number: number, schema: JsonSchema): void {
        if (!Number.isFinite(number) || this.invalidInteger(number, schema)) {
            throw new RangeError(`Projection numeric value '${number}' is outside the supported ${schema.type}/${schema.format ?? 'double'} range.`);
        }
    }

    private static invalidInteger(number: number, schema: JsonSchema): boolean {
        if (schema.type !== 'integer') return false;
        if (!Number.isSafeInteger(number)) return true;
        if (schema.format === 'int32') return number < -2147483648 || number > 2147483647;
        if (schema.format === 'uint32') return number < 0 || number > 4294967295;
        return false;
    }

    private static boolean(value: unknown, eventContent: boolean): boolean {
        if (typeof value === 'boolean') return value;
        if (!eventContent && this.booleanText(value)) return value.toLowerCase() === 'true';
        throw new RangeError(`Projection boolean value '${String(value)}' requires a kernel-backed test (ChronicleKernelScenario / live kernel).`);
    }

    private static booleanText(value: unknown): value is string {
        return typeof value === 'string' && /^(true|false)$/i.test(value);
    }

    private static number(value: unknown, schema: JsonSchema, eventContent: boolean): number {
        if (eventContent && typeof value !== 'number') {
            throw new RangeError(`Projection event numeric value '${String(value)}' must be a JSON number.`);
        }
        if (typeof value !== 'number' && !this.numericText(value, schema)) {
            throw new RangeError(`Projection numeric value '${String(value)}' is not supported by ${schema.type}/${schema.format ?? 'double'}.`);
        }
        const number = typeof value === 'number' ? value : Number(value);
        this.checkNumber(number, schema);
        return number;
    }

    private static numericText(value: unknown, schema: JsonSchema): boolean {
        if (typeof value !== 'string') return false;
        return schema.type === 'integer' ? /^[+-]?\d+$/.test(value) : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value);
    }

    private static dateTime(value: unknown): unknown {
        if (value === '0001-01-01T00:00:00') return value; // Kernel default for a missing DateTime member.
        if (!this.utcDateTime(value)) {
            throw new RangeError(`Projection date-time value '${String(value)}' is outside the supported DateTime range or UTC ISO format.`);
        }
        return value;
    }

    private static utcDateTime(value: unknown): boolean {
        // Date.parse accepts years beyond DateTime.MaxValue and normalizes invalid calendar dates.
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
        if (+value.slice(0, 4) < 1 || !Number.isFinite(Date.parse(value))) return false;
        return new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
    }

    private static stringSchema(schema: JsonSchema): boolean {
        return schema.type === 'string' || (Array.isArray(schema.type) && schema.type[0] === 'string');
    }

    private static schemaString(value: unknown, schema: JsonSchema, eventContent: boolean): unknown {
        if (eventContent && this.stringSchema(schema)) this.checkEventString(value);
        return this.string(value, schema);
    }

    private static checkEventString(value: unknown): void {
        if (typeof value !== 'string') {
            throw new RangeError(`Projection event string value '${String(value)}' must be a JSON string.`);
        }
    }

    private static string(value: unknown, schema: JsonSchema): unknown {
        if (schema.format === 'guid' && typeof value === 'string') return this.guid(value);
        if (schema.type === 'string' && typeof value !== 'string') return String(value);
        return value;
    }

    private static guid(value: string): string {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            throw new RangeError(`Projection GUID value '${value}' requires a kernel-backed test (ChronicleKernelScenario / live kernel).`);
        }
        return value.toLowerCase();
    }
}
