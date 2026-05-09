// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the subtractFrom property decorator. */
export interface SubtractFromMetadata {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
    /** The event property name whose value is subtracted from the read model property. Defaults to the decorated property name. */
    readonly eventPropertyName?: string;
}

const METADATA_KEY = 'chronicle:projection:subtractFrom';

/**
 * Property decorator that subtracts an event property value from the decorated read model property.
 * @param eventType - The event constructor.
 * @param eventPropertyName - Optional event property name. Defaults to the property name.
 * @returns A property decorator.
 */
export function subtractFrom(eventType: Function, eventPropertyName?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        const existing: SubtractFromMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: SubtractFromMetadata = { eventType, eventPropertyName };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all subtractFrom metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of subtractFrom metadata entries.
 */
export function getSubtractFromMetadata(target: object, propertyKey: string): SubtractFromMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
