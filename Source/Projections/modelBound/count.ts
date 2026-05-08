// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the count property decorator. */
export interface CountMetadata {
    /** The event constructor whose occurrences are counted. */
    readonly eventType: Function;
    /** Optional constant key. All events will update the same read model instance. */
    readonly constantKey?: string;
}

const METADATA_KEY = 'chronicle:projection:count';

/**
 * Property decorator that counts the occurrences of the specified event into the decorated read model property.
 * @param eventType - The event constructor.
 * @param constantKey - Optional constant key value.
 * @returns A property decorator.
 */
export function count(eventType: Function, constantKey?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        const existing: CountMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: CountMetadata = { eventType, constantKey };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all count metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of count metadata entries.
 */
export function getCountMetadata(target: object, propertyKey: string): CountMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
