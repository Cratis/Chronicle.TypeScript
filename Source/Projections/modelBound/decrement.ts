// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types';

/** Metadata stored by the decrement property decorator. */
export interface DecrementMetadata {
    /** The event constructor that triggers the decrement. */
    readonly eventType: Function;
    /** Optional constant key. All events will update the same read model instance. */
    readonly constantKey?: string;
}

const METADATA_KEY = 'chronicle:projection:decrement';

/**
 * Property decorator that decrements the decorated read model property each time the specified event occurs.
 * @param eventType - The event constructor.
 * @param constantKey - Optional constant key value.
 * @returns A property decorator.
 */
export function decrement(eventType: Function, constantKey?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const existing: DecrementMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: DecrementMetadata = { eventType, constantKey };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all decrement metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of decrement metadata entries.
 */
export function getDecrementMetadata(target: object, propertyKey: string): DecrementMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
