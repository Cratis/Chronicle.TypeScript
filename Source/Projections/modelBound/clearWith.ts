// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the clearWith class or property decorator. */
export interface ClearWithMetadata {
    /** The event constructor that clears the nested object or projection. */
    readonly eventType: Function;
}

const CLASS_METADATA_KEY = 'chronicle:projection:clearWith:class';
const PROPERTY_METADATA_KEY = 'chronicle:projection:clearWith:property';

/**
 * Class or property decorator that specifies the event type that clears a nested object.
 * When used on a class, it clears the entire nested object.
 * When used on a property, it clears only that property.
 * @param eventType - The event constructor.
 * @returns A class and property decorator.
 */
export function clearWith(eventType: Function): ClassDecorator & PropertyDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        if (propertyKey !== undefined) {
            const key = propertyKey.toString();
            const existing: ClearWithMetadata[] = Reflect.getMetadata(PROPERTY_METADATA_KEY, target, key) ?? [];
            Reflect.defineMetadata(PROPERTY_METADATA_KEY, [...existing, { eventType }], target, key);
        } else {
            const existing: ClearWithMetadata[] = Reflect.getMetadata(CLASS_METADATA_KEY, target) ?? [];
            Reflect.defineMetadata(CLASS_METADATA_KEY, [...existing, { eventType }], target);
        }
    };
}

/**
 * Retrieves clearWith metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of clearWith metadata entries.
 */
export function getClearWithClassMetadata(target: Function): ClearWithMetadata[] {
    return Reflect.getMetadata(CLASS_METADATA_KEY, target) ?? [];
}

/**
 * Retrieves clearWith metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of clearWith metadata entries.
 */
export function getClearWithPropertyMetadata(target: object, propertyKey: string): ClearWithMetadata[] {
    return Reflect.getMetadata(PROPERTY_METADATA_KEY, target, propertyKey) ?? [];
}
