// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';

/** Schema boundaries shared by root, join, and child mappings. */
export class ProjectionSchemaCapabilities {
    static numeric(schema: JsonSchema): boolean {
        if (schema.type === 'number') return this.doubleFormat(schema);
        return this.integer(schema);
    }

    static compatible(source: JsonSchema, target: JsonSchema): boolean {
        if (this.sameSchema(source, target)) return this.scalar(source);
        if (this.plainString(source)) return this.textTarget(target);
        if (source.type === 'string' && source.format === 'guid') return this.plainString(target);
        return this.integerToNumber(source, target);
    }

    static check(schema: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        this.checkProtected(schema, path, reject);
        if (!this.supportedType(schema.type) || !this.supportedFormat(schema)) {
            reject(path, `schema type/format '${schema.type ?? 'unknown'}${schema.format ? `/${schema.format}` : ''}' requires a kernel-backed test`);
        }
        this.checkIntegerWidth(schema, path, reject);
        this.checkItems(schema, path, reject);
        if (schema.type === 'object') this.checkProperties(schema, path, reject);
    }

    static checkProtection(schema: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        this.checkProtected(schema, path, reject);
        for (const [name, property] of Object.entries(schema.properties ?? {})) this.checkProtection(property, `${path}.${name}`, reject);
        if (schema.items) this.checkProtection(schema.items, `${path}.items`, reject);
        this.checkAdditionalProtection(schema, path, reject);
    }

    static outsideIntegerRange(value: number, schema: JsonSchema): boolean {
        if (!Number.isSafeInteger(value)) return true;
        if (schema.format === 'int32') return value < -2147483648 || value > 2147483647;
        if (schema.format === 'uint32') return value < 0 || value > 4294967295;
        return false;
    }

    private static doubleFormat(schema: JsonSchema): boolean {
        return !schema.format || schema.format === 'double';
    }

    private static integer(schema: JsonSchema): boolean {
        return schema.type === 'integer' && ['int32', 'uint32'].includes(schema.format ?? '');
    }

    private static sameSchema(source: JsonSchema, target: JsonSchema): boolean {
        return JSON.stringify(source.type) === JSON.stringify(target.type) && source.format === target.format;
    }

    private static scalar(schema: JsonSchema): boolean {
        return schema.type !== 'object' && schema.type !== 'array';
    }

    private static nullableString(type: JsonSchema['type']): boolean {
        return Array.isArray(type) && type[0] === 'string' && type[1] === 'null';
    }

    private static checkIntegerWidth(schema: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        if (schema.type === 'integer' && !this.numeric(schema)) reject(path, 'integer width requires a kernel-backed test');
    }

    private static checkItems(schema: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        if (schema.type === 'array' && schema.items) this.check(schema.items, path, reject);
    }

    private static plainString(schema: JsonSchema): boolean {
        return schema.type === 'string' && !schema.format;
    }

    private static textTarget(target: JsonSchema): boolean {
        if (this.nullableString(target.type)) return true;
        return this.numeric(target);
    }

    private static integerToNumber(source: JsonSchema, target: JsonSchema): boolean {
        if (!this.integer(source)) return false;
        return target.type === 'number' && this.numeric(target);
    }

    private static supportedType(type: JsonSchema['type']): boolean {
        if (!type || type === 'null') return false;
        if (!Array.isArray(type)) return true;
        return type.length === 2 && this.nullableString(type);
    }

    private static supportedFormat(schema: JsonSchema): boolean {
        if (!schema.format) return true;
        const types: Record<string, string> = { guid: 'string', 'date-time': 'string', double: 'number', int32: 'integer', uint32: 'integer' };
        return Object.hasOwn(types, schema.format) && schema.type === types[schema.format];
    }

    private static checkProtected(schema: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        if (schema.compliance?.length || schema.security?.length) reject(path, 'protected fields require a kernel-backed test');
    }

    private static checkProperties(schema: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        for (const property of Object.values(schema.properties ?? {})) this.check(property, path, reject);
    }

    private static checkAdditionalProtection(schema: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
            this.checkProtection(schema.additionalProperties, `${path}.additionalProperties`, reject);
        }
    }
}
