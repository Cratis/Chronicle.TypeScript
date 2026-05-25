// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../types';

/** Metadata key used to store seeder information on a class. */
const SEEDER_METADATA_KEY = 'chronicle:seeder';

/**
 * Metadata stored on a seeder class.
 */
export interface SeederMetadata {
    /** Marker indicating this type is an event seeder. */
    readonly isSeeder: true;
}

/**
 * TypeScript decorator that marks a class as an event seeder.
 * This is the TypeScript equivalent of a discoverable event seeder artifact.
 *
 * @returns A class decorator.
 */
export function seeder(): ClassDecorator {
    return (target: object) => {
        const constructor = target as Function;
        const metadata: SeederMetadata = { isSeeder: true };
        Reflect.defineMetadata(SEEDER_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.Seeder,
            constructor as Constructor,
            constructor.name
        );
    };
}

/**
 * Gets the {@link SeederMetadata} associated with a class decorated with {@link seeder}.
 * @param target - The class constructor to retrieve metadata for.
 * @returns The associated metadata, or undefined if not decorated.
 */
export function getSeederMetadata(target: Function): SeederMetadata | undefined {
    return Reflect.getMetadata(SEEDER_METADATA_KEY, target);
}

/**
 * Checks whether a class has been decorated with {@link seeder}.
 * @param target - The class constructor to check.
 * @returns True if the class has a seeder decorator; otherwise false.
 */
export function isSeeder(target: Function): boolean {
    return getSeederMetadata(target) !== undefined;
}
