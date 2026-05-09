// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the removedWithJoin class or property decorator. */
export interface RemovedWithJoinMetadata {
    /** The event constructor that triggers removal via a join. */
    readonly eventType: Function;
    /** The event property name that identifies the instance to remove. Defaults to the event source identifier. */
    readonly key?: string;
}

const CLASS_METADATA_KEY = 'chronicle:projection:removedWithJoin:class';
const PROPERTY_METADATA_KEY = 'chronicle:projection:removedWithJoin:property';

/**
 * Class or property decorator that specifies the event type that removes a read model instance or child via a join.
 * @param eventType - The event constructor.
 * @param key - Optional event property name used as the key to identify the instance to remove.
 * @returns A class and property decorator.
 */
export function removedWithJoin(eventType: Function, key?: string): ClassDecorator & PropertyDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        if (propertyKey !== undefined) {
            const propKey = propertyKey.toString();
            const existing: RemovedWithJoinMetadata[] = Reflect.getMetadata(PROPERTY_METADATA_KEY, target, propKey) ?? [];
            Reflect.defineMetadata(PROPERTY_METADATA_KEY, [...existing, { eventType, key }], target, propKey);
        } else {
            const existing: RemovedWithJoinMetadata[] = Reflect.getMetadata(CLASS_METADATA_KEY, target) ?? [];
            Reflect.defineMetadata(CLASS_METADATA_KEY, [...existing, { eventType, key }], target);
        }
    };
}

/**
 * Retrieves removedWithJoin metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of removedWithJoin metadata entries.
 */
export function getRemovedWithJoinClassMetadata(target: Function): RemovedWithJoinMetadata[] {
    return Reflect.getMetadata(CLASS_METADATA_KEY, target) ?? [];
}

/**
 * Retrieves removedWithJoin metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of removedWithJoin metadata entries.
 */
export function getRemovedWithJoinPropertyMetadata(target: object, propertyKey: string): RemovedWithJoinMetadata[] {
    return Reflect.getMetadata(PROPERTY_METADATA_KEY, target, propertyKey) ?? [];
}
