// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the join property decorator. */
export interface JoinMetadata {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
    /** The read model property name used to form the join relationship. */
    readonly on?: string;
    /** The event property name to read the joined value from. Defaults to the decorated property name. */
    readonly eventPropertyName?: string;
}

const METADATA_KEY = 'chronicle:projection:join';

/**
 * Property decorator that configures a join relationship with an event type.
 * @param eventType - The event constructor.
 * @param on - Optional property name on the read model to join on.
 * @param eventPropertyName - Optional event property name. Defaults to the property name.
 * @returns A property decorator.
 */
export function join(eventType: Function, on?: string, eventPropertyName?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        const existing: JoinMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        const metadata: JoinMetadata = { eventType, on, eventPropertyName };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all join metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of join metadata entries.
 */
export function getJoinMetadata(target: object, propertyKey: string): JoinMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
