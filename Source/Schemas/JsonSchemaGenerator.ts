// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Guid } from '@cratis/fundamentals';
import { JsonSchema } from './JsonSchema';
import { TypeIntrospector } from '../types';

/**
 * Generates JSON schemas for class constructors using reflection metadata.
 */
export class JsonSchemaGenerator {
    private static readonly _knownTypeFormats = new Map<Function, { type: JsonSchema['type']; format: string }>([
        [Guid, { type: 'string', format: 'guid' }],
        [Date, { type: 'string', format: 'date-time' }]
    ]);

    private static readonly _formatAliases = new Map<string, string>([
        ['uuid', 'guid']
    ]);

    /**
     * Creates an empty schema for a type name.
     * @param title - The title to use for the schema.
     * @returns An empty object schema.
     */
    static createEmptySchema(title: string): JsonSchema {
        return {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            title,
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false
        };
    }

    /**
     * Generates a JSON schema for a class constructor.
     * @param target - The class constructor to generate schema for.
     * @param members - Optional pre-introspected members for reuse.
     * @returns The generated JSON schema.
     */
    static generate(target: Function, members?: ReadonlyMap<string, Function | undefined>): JsonSchema {
        const membersToUse = members ?? TypeIntrospector.getMembers(target);
        const schemaProperties: Record<string, JsonSchema> = {};
        for (const [memberName, memberType] of membersToUse.entries()) {
            schemaProperties[memberName] = this.mapRuntimeTypeToSchema(memberType);
        }

        return {
            ...this.createEmptySchema(target.name),
            properties: schemaProperties,
            required: Array.from(membersToUse.keys()),
        };
    }

    private static mapRuntimeTypeToSchema(runtimeType: Function | undefined): JsonSchema {
        const knownTypeFormat = this.getKnownTypeFormat(runtimeType);
        if (knownTypeFormat) {
            return knownTypeFormat;
        }

        if (runtimeType === String) {
            return { type: 'string' };
        }

        if (runtimeType === Number) {
            return { type: 'number' };
        }

        if (runtimeType === Boolean) {
            return { type: 'boolean' };
        }

        if (runtimeType === Array) {
            return { type: 'array', items: { type: 'object' } };
        }

        if (runtimeType && runtimeType !== Object) {
            return this.generate(runtimeType);
        }

        return { type: 'object' };
    }

    private static getKnownTypeFormat(runtimeType: Function | undefined): JsonSchema | undefined {
        if (!runtimeType) {
            return undefined;
        }

        const known = this._knownTypeFormats.get(runtimeType);
        if (!known) {
            return undefined;
        }

        return {
            type: known.type,
            format: this.normalizeFormat(known.format)
        };
    }

    private static normalizeFormat(format: string): string {
        const normalized = format.toLowerCase();
        return this._formatAliases.get(normalized) ?? normalized;
    }
}
