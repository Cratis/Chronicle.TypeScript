// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types';

/** Metadata stored by the setValue property decorator. */
export interface SetValueMetadata {
    /** The event constructor that triggers the value assignment. */
    readonly eventType: Function;
    /** The constant value to assign to the property when the event occurs. */
    readonly value: unknown;
}

const METADATA_KEY = 'chronicle:projection:setValue';

/**
 * Property decorator that sets the decorated read model property to a constant value when the specified event occurs.
 * @param eventType - The event constructor.
 * @param value - The constant value to assign.
 * @returns A property decorator.
 */
export function setValue(eventType: Function, value: unknown): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const existing: SetValueMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: SetValueMetadata = { eventType, value };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all setValue metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of setValue metadata entries.
 */
export function getSetValueMetadata(target: object, propertyKey: string): SetValueMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
