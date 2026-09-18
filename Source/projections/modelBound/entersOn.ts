// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the entersOn class decorator. */
export interface EntersOnMetadata {
    /** The event constructor that may create or resurrect the variant. */
    readonly eventType: Function;
    /** The event property name used as the key. Defaults to the event source identifier. */
    readonly key?: string;
}

const METADATA_KEY = 'chronicle:projection:entersOn';

/**
 * Class decorator that names an event that may create or resurrect a read model variant.
 * Repeatable - a variant may enter on more than one event. Every event a variant projects
 * from that is not named here is automatically reclassified into an update-only join: it
 * can bring an already-active instance up to date, but it can never create or resurrect one.
 * @param eventType - The event constructor.
 * @param key - Optional event property name used as the key. Defaults to the event source identifier.
 * @returns A class decorator.
 */
export function entersOn(eventType: Function, key?: string): ClassDecorator {
    return (target: object) => {
        const existing: EntersOnMetadata[] = Reflect.getMetadata(METADATA_KEY, target) ?? [];
        Reflect.defineMetadata(METADATA_KEY, [...existing, { eventType, key }], target);
    };
}

/**
 * Retrieves entersOn metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of entersOn metadata entries.
 */
export function getEntersOnMetadata(target: Function): EntersOnMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target) ?? [];
}
