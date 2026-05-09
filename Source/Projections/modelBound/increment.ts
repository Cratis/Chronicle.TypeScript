// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the increment property decorator. */
export interface IncrementMetadata {
    /** The event constructor that triggers the increment. */
    readonly eventType: Function;
    /** Optional constant key. All events will update the same read model instance. */
    readonly constantKey?: string;
}

const METADATA_KEY = 'chronicle:projection:increment';

/**
 * Property decorator that increments the decorated read model property each time the specified event occurs.
 * @param eventType - The event constructor.
 * @param constantKey - Optional constant key value.
 * @returns A property decorator.
 */
export function increment(eventType: Function, constantKey?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        const existing: IncrementMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: IncrementMetadata = { eventType, constantKey };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all increment metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of increment metadata entries.
 */
export function getIncrementMetadata(target: object, propertyKey: string): IncrementMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
