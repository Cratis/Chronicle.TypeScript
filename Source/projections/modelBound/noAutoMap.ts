// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types';

const CLASS_METADATA_KEY = 'chronicle:projection:noAutoMap:class';
const PROPERTY_METADATA_KEY = 'chronicle:projection:noAutoMap:property';

/**
 * Class or property decorator that disables AutoMap for a model-bound projection.
 * Applied to a class, it prevents AutoMap from mapping any property automatically.
 * Applied to a property, it excludes only that single property from AutoMap while every other
 * property keeps mapping - use it to stop an unrelated event that carries an identically named
 * property from silently overwriting a property whose value is set explicitly (for example via
 * `setFrom`).
 * @param target - The class constructor, or the class prototype when used on a property.
 * @param propertyKey - The property name, when used as a property decorator.
 */
export function noAutoMap(target: object, propertyKey?: string | symbol): void {
    if (propertyKey !== undefined) {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        Reflect.defineMetadata(PROPERTY_METADATA_KEY, true, target, key);
    } else {
        Reflect.defineMetadata(CLASS_METADATA_KEY, true, target as Function);
    }
}

/**
 * Checks whether the given class has AutoMap disabled entirely.
 * @param target - The class constructor.
 * @returns True if the class is marked with {@link noAutoMap}; false otherwise.
 */
export function isNoAutoMap(target: Function): boolean {
    return Reflect.hasMetadata(CLASS_METADATA_KEY, target);
}

/**
 * Checks whether a specific property is excluded from AutoMap.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns True if the property is marked with {@link noAutoMap}; false otherwise.
 */
export function isPropertyNoAutoMap(target: object, propertyKey: string): boolean {
    return Reflect.hasMetadata(PROPERTY_METADATA_KEY, target, propertyKey);
}
