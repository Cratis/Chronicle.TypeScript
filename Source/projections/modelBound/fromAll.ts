// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { decorateModelBoundProperty } from '../../types/modelBoundProperty.js';
import { ChroniclePropertyDecorator, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';

/** Metadata stored by the fromAll property decorator. */
export interface FromAllMetadata {
    /** The event property name to read the value from. */
    readonly property?: string;
    /** The event context property name to read the value from. */
    readonly contextProperty?: string;
}

const METADATA_KEY = 'chronicle:projection:fromAll';

/**
 * Subscribes the root projection to every event type and maps the decorated property on each event,
 * including events not declared with `fromEvent`. Unlike `fromEvery`, this expands the subscription.
 * Use `fromEvery` when only already-subscribed events should update the property.
 * @param property - Optional event property name. If not specified, uses the model property name.
 * @param contextProperty - Optional event context property name.
 * @returns A property decorator.
 */
export function fromAll(property?: string, contextProperty?: string): ChroniclePropertyDecorator {
    return decorateModelBoundProperty((target: object, propertyKey: string | symbol) => {
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, propertyKey.toString());
        const metadata: FromAllMetadata = { property, contextProperty };
        Reflect.defineMetadata(METADATA_KEY, metadata, target, propertyKey.toString());
    });
}

/**
 * Retrieves fromAll metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The fromAll metadata, or undefined if not decorated.
 */
export function getFromAllMetadata(target: object, propertyKey: string): FromAllMetadata | undefined {
    return getPropertyMetadata<FromAllMetadata>(METADATA_KEY, target, propertyKey);
}
