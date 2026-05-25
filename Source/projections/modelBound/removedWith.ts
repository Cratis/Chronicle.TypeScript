// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types';

/** Metadata stored by the removedWith class or property decorator. */
export interface RemovedWithMetadata {
    /** The event constructor that triggers removal. */
    readonly eventType: Function;
    /** The event property name that identifies the instance to remove. Defaults to the event source identifier. */
    readonly key?: string;
    /** The event property name that identifies the parent instance (for children). Defaults to the event source identifier. */
    readonly parentKey?: string;
}

const CLASS_METADATA_KEY = 'chronicle:projection:removedWith:class';
const PROPERTY_METADATA_KEY = 'chronicle:projection:removedWith:property';

/**
 * Class or property decorator that specifies the event type that removes a read model instance or child.
 * When used on a class, it removes the read model instance.
 * When used on a property, it removes a child from the collection.
 * @param eventType - The event constructor.
 * @param key - Optional event property name used as the key to identify the instance to remove.
 * @param parentKey - Optional event property name used as the parent key (for children only).
 * @returns A class and property decorator.
 */
export function removedWith(eventType: Function, key?: string, parentKey?: string): ClassDecorator & PropertyDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        if (propertyKey !== undefined) {
            const propKey = propertyKey.toString();
            TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, propKey);
            const existing: RemovedWithMetadata[] = Reflect.getMetadata(PROPERTY_METADATA_KEY, target, propKey) ?? [];
            Reflect.defineMetadata(PROPERTY_METADATA_KEY, [...existing, { eventType, key, parentKey }], target, propKey);
        } else {
            const existing: RemovedWithMetadata[] = Reflect.getMetadata(CLASS_METADATA_KEY, target) ?? [];
            Reflect.defineMetadata(CLASS_METADATA_KEY, [...existing, { eventType, key, parentKey }], target);
        }
    };
}

/**
 * Retrieves removedWith metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of removedWith metadata entries.
 */
export function getRemovedWithClassMetadata(target: Function): RemovedWithMetadata[] {
    return Reflect.getMetadata(CLASS_METADATA_KEY, target) ?? [];
}

/**
 * Retrieves removedWith metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of removedWith metadata entries.
 */
export function getRemovedWithPropertyMetadata(target: object, propertyKey: string): RemovedWithMetadata[] {
    return Reflect.getMetadata(PROPERTY_METADATA_KEY, target, propertyKey) ?? [];
}
