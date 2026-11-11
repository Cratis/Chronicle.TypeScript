// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';
import { ProjectionSchemaCapabilities } from './ProjectionSchemaCapabilities.js';

/** Validates initial state without changing its JSON order or defaulting semantics. */
export class ProjectionInitialValueCapabilities {
    static validate(initialState: string, schema: JsonSchema, reject: ProjectionCapabilityReject): Record<string, unknown> {
        let initial: unknown;
        try { initial = JSON.parse(initialState); }
        catch { reject('InitialModelState', 'initial values must be a JSON object'); }
        if (initial === null || typeof initial !== 'object' || Array.isArray(initial)) {
            reject('InitialModelState', 'initial values must be a JSON object');
        }
        for (const [property, value] of Object.entries(initial as Record<string, unknown>)) {
            const target = schema.properties?.[property] ?? reject(`InitialModelState.${property}`, 'initial value has no read-model schema');
            ProjectionSchemaCapabilities.check(target, `InitialModelState.${property}`, reject);
            this.check(value, target, `InitialModelState.${property}`, reject);
        }
        return initial as Record<string, unknown>;
    }

    private static check(value: unknown, target: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        if (value === null && this.nullable(target)) return;
        if (this.structured(target) || target.format === 'date-time') {
            reject(path, 'initial object, array, or date-time values require a kernel-backed test');
        }
        this.scalar(value, target, path, reject);
    }

    private static scalar(value: unknown, target: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        if (target.type === 'integer' || target.type === 'number') return this.number(value, target, path, reject);
        if (target.type === 'boolean') return this.boolean(value, path, reject);
        if (target.type === 'string' || Array.isArray(target.type)) return this.string(value, target, path, reject);
        reject(path, 'initial value requires a kernel-backed test');
    }

    private static nullable(schema: JsonSchema): boolean {
        return Array.isArray(schema.type) && schema.type.includes('null');
    }

    private static structured(schema: JsonSchema): boolean {
        return schema.type === 'object' || schema.type === 'array';
    }

    private static number(value: unknown, target: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        if (typeof value !== 'number') reject(path, 'initial numeric value must be a JSON number');
        if (!Number.isFinite(value) || this.invalidInteger(value as number, target)) {
            reject(path, 'initial numeric value is outside the supported finite/integer range');
        }
    }

    private static invalidInteger(value: number, target: JsonSchema): boolean {
        return target.type === 'integer' && ProjectionSchemaCapabilities.outsideIntegerRange(value, target);
    }

    private static boolean(value: unknown, path: string, reject: ProjectionCapabilityReject): void {
        if (typeof value !== 'boolean') reject(path, 'initial boolean value must be a JSON boolean');
    }

    private static string(value: unknown, target: JsonSchema, path: string, reject: ProjectionCapabilityReject): void {
        if (typeof value !== 'string') reject(path, 'initial string value must be a JSON string');
        if (target.format === 'guid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value as string)) {
            reject(path, 'initial GUID value must be canonical lowercase text');
        }
    }
}
