// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types';

/** Metadata stored by the addFrom property decorator. */
export interface AddFromMetadata {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
    /** The event property name whose value is added to the read model property. Defaults to the decorated property name. */
    readonly eventPropertyName?: string;
}

const METADATA_KEY = 'chronicle:projection:addFrom';

/**
 * Property decorator that adds an event property value to the decorated read model property.
 * @param eventType - The event constructor.
 * @param eventPropertyName - Optional event property name. Defaults to the property name.
 * @returns A property decorator.
 */
export function addFrom(eventType: Function, eventPropertyName?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const existing: AddFromMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: AddFromMetadata = { eventType, eventPropertyName };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all addFrom metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of addFrom metadata entries.
 */
export function getAddFromMetadata(target: object, propertyKey: string): AddFromMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
