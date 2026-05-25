// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types';

/** Metadata stored by the fromEvery property decorator. */
export interface FromEveryMetadata {
    /** The event or event context property name to read the value from. */
    readonly property?: string;
    /** The event context property name to read the value from. */
    readonly contextProperty?: string;
}

const METADATA_KEY = 'chronicle:projection:fromEvery';

/**
 * Property decorator that sets the decorated read model property from a property present on every projected event.
 * @param property - Optional event property name. If not specified, uses the model property name.
 * @param contextProperty - Optional event context property name.
 * @returns A property decorator.
 */
export function fromEvery(property?: string, contextProperty?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, propertyKey.toString());
        const metadata: FromEveryMetadata = { property, contextProperty };
        Reflect.defineMetadata(METADATA_KEY, metadata, target, propertyKey.toString());
    };
}

/**
 * Retrieves fromEvery metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The fromEvery metadata, or undefined if not decorated.
 */
export function getFromEveryMetadata(target: object, propertyKey: string): FromEveryMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey);
}
