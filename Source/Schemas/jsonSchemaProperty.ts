// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../types';

/**
 * Decorates a class property so its runtime type metadata can be used for JSON schema generation.
 * @returns A property decorator.
 */
export function jsonSchemaProperty(): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        TypeIntrospector.trackProperty(target.constructor as Function, propertyKey.toString());
    };
}

/**
 * Gets all tracked schema properties for a type.
 * @param target - The class constructor to inspect.
 * @returns The tracked property names.
 */
export function getTrackedJsonSchemaProperties(target: Function): string[] {
    return TypeIntrospector.getTrackedProperties(target);
}
