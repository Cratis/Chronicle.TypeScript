// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Options for the fromEvent class decorator. */
export interface FromEventOptions {
    /** The event property name to use as the key to identify the read model instance. */
    readonly key?: string;
    /** The event property name to use as the parent key for child relationships. */
    readonly parentKey?: string;
    /** A constant string value to use as the key. All events will update the same instance. */
    readonly constantKey?: string;
}

/** Metadata stored by the fromEvent decorator on a class. */
export interface FromEventMetadata extends FromEventOptions {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
}

const METADATA_KEY = 'chronicle:projection:fromEvent';

/**
 * Class decorator that declares which event type populates instances of this read model.
 * @param eventType - The event constructor.
 * @param options - Optional key configuration.
 * @returns A class decorator.
 */
export function fromEvent(eventType: Function, options?: FromEventOptions): ClassDecorator {
    return (target: object) => {
        const existing: FromEventMetadata[] = Reflect.getMetadata(METADATA_KEY, target) ?? [];
        const metadata: FromEventMetadata = { eventType, ...options };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target);
    };
}

/**
 * Retrieves all fromEvent metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of fromEvent metadata entries.
 */
export function getFromEventMetadata(target: Function): FromEventMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target) ?? [];
}

/**
 * Checks whether the given class has any fromEvent metadata.
 * @param target - The class constructor.
 * @returns True if the class has fromEvent metadata; false otherwise.
 */
export function hasFromEventMetadata(target: Function): boolean {
    return Reflect.hasMetadata(METADATA_KEY, target);
}
