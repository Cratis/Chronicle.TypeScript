// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { ChroniclePropertyDecorator, decorateProperty, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';

const METADATA_KEY = 'chronicle:graph:key';

/**
 * Property decorator that marks the unique key of a node, or the property that identifies an edge among edges of the
 * same type between the same two nodes.
 * @returns A property decorator.
 */
export function graphKey(): ChroniclePropertyDecorator {
    return decorateProperty((target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        Reflect.defineMetadata(METADATA_KEY, true, target, key);
    });
}

/**
 * Gets whether a property is marked with the graphKey decorator.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns True if it is marked, false if not.
 */
export function isGraphKey(target: object, propertyKey: string): boolean {
    return getPropertyMetadata<boolean>(METADATA_KEY, target, propertyKey) === true;
}
