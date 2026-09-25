// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { hasPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';
import { decorateModelBoundProperty } from '../../types/modelBoundProperty.js';

const METADATA_KEY = 'chronicle:projection:nested';

/**
 * Property decorator that marks a single nullable property as a nested sub-projection object.
 * The nested type should carry its own fromEvent and optionally clearWith decorators.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 */
const decorateNested = decorateModelBoundProperty((target: object, propertyKey: string | symbol): void => {
    const key = propertyKey.toString();
    TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
    Reflect.defineMetadata(METADATA_KEY, true, target, key);
});

export function nested(target: object, propertyKey: string | symbol): void;
export function nested(value: undefined, context: ClassFieldDecoratorContext): void;
export function nested(target: object | undefined, propertyKeyOrContext: string | symbol | ClassFieldDecoratorContext): void {
    decorateNested(target as undefined, propertyKeyOrContext as ClassFieldDecoratorContext);
}

/**
 * Checks whether the given property is marked as a nested sub-projection.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns True if the property is marked as nested; false otherwise.
 */
export function isNested(target: object, propertyKey: string): boolean {
    return hasPropertyMetadata(METADATA_KEY, target, propertyKey);
}
