// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { JsonSchema } from './JsonSchema';
import { getTrackedJsonSchemaProperties } from './jsonSchemaProperty';

/**
 * Generates JSON schemas for class constructors using reflection metadata.
 */
export class JsonSchemaGenerator {
    /**
     * Generates a JSON schema for a class constructor.
     * @param target - The class constructor to generate schema for.
     * @returns The generated JSON schema.
     */
    static generate(target: Function): JsonSchema {
        const properties = getTrackedJsonSchemaProperties(target);
        const schemaProperties: Record<string, JsonSchema> = {};
        for (const property of properties) {
            const runtimeType = Reflect.getMetadata('design:type', target.prototype, property) as Function | undefined;
            schemaProperties[property] = this.mapRuntimeTypeToSchema(runtimeType);
        }

        return {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            title: target.name,
            type: 'object',
            properties: schemaProperties,
            required: properties,
            additionalProperties: false
        };
    }

    private static mapRuntimeTypeToSchema(runtimeType: Function | undefined): JsonSchema {
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
}
