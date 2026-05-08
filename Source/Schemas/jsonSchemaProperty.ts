// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata key for tracked schema properties on a target type. */
const JSON_SCHEMA_PROPERTIES_METADATA_KEY = 'chronicle:jsonSchema:properties';

/**
 * Decorates a class property so its runtime type metadata can be used for JSON schema generation.
 * @returns A property decorator.
 */
export function jsonSchemaProperty(): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const existing = getTrackedJsonSchemaProperties(target.constructor as Function);
        const property = propertyKey.toString();
        if (existing.includes(property)) {
            return;
        }

        Reflect.defineMetadata(JSON_SCHEMA_PROPERTIES_METADATA_KEY, [...existing, property], target.constructor);
    };
}

/**
 * Gets all tracked schema properties for a type.
 * @param target - The class constructor to inspect.
 * @returns The tracked property names.
 */
export function getTrackedJsonSchemaProperties(target: Function): string[] {
    return Reflect.getMetadata(JSON_SCHEMA_PROPERTIES_METADATA_KEY, target) ?? [];
}
