// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the setFromContext property decorator. */
export interface SetFromContextMetadata {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
    /** The event context property name to read the value from. Defaults to the decorated property name. */
    readonly contextPropertyName?: string;
}

const METADATA_KEY = 'chronicle:projection:setFromContext';

/**
 * Property decorator that maps a value from an event context property onto the decorated read model property.
 * @param eventType - The event constructor.
 * @param contextPropertyName - Optional event context property name. Defaults to the property name.
 * @returns A property decorator.
 */
export function setFromContext(eventType: Function, contextPropertyName?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        const existing: SetFromContextMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: SetFromContextMetadata = { eventType, contextPropertyName };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all setFromContext metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of setFromContext metadata entries.
 */
export function getSetFromContextMetadata(target: object, propertyKey: string): SetFromContextMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
