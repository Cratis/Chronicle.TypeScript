// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types';

/** Metadata stored by the setFrom property decorator. */
export interface SetFromMetadata {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
    /** The event property name to read the value from. Defaults to the decorated property name. */
    readonly eventPropertyName?: string;
}

const METADATA_KEY = 'chronicle:projection:setFrom';

/**
 * Property decorator that maps an event property value onto the decorated read model property.
 * @param eventType - The event constructor.
 * @param eventPropertyName - Optional event property name. Defaults to the property name.
 * @returns A property decorator.
 */
export function setFrom(eventType: Function, eventPropertyName?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const existing: SetFromMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: SetFromMetadata = { eventType, eventPropertyName };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all setFrom metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of setFrom metadata entries.
 */
export function getSetFromMetadata(target: object, propertyKey: string): SetFromMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
