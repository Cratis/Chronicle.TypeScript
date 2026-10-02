// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { decorateModelBoundProperty } from '../../types/modelBoundProperty.js';
import { ChroniclePropertyDecorator, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';
import type { FromAllEventsMetadata } from './FromAllEventsMetadata.js';

const METADATA_KEY = 'chronicle:projection:fromAllEvents';

/**
 * Subscribes the root projection to every event type and maps the decorated property on each event,
 * including events not declared with `fromEvent`. Mappings also apply to children and take precedence
 * over `fromEvery` and the deprecated `fromAll` alias on the same property.
 * Opting in changes the definition and may trigger replay; unrelated events can create rows or clear
 * mapped properties. Use `fromEvery` to map only already-subscribed events.
 * @param property - Optional event property name. If not specified, uses the model property name.
 * @param contextProperty - Optional event context property name.
 * @returns A property decorator.
 */
export function fromAllEvents(property?: string, contextProperty?: string): ChroniclePropertyDecorator {
    return decorateModelBoundProperty((target: object, propertyKey: string | symbol) => {
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, propertyKey.toString());
        const metadata: FromAllEventsMetadata = { property, contextProperty };
        Reflect.defineMetadata(METADATA_KEY, metadata, target, propertyKey.toString());
    });
}

/**
 * Retrieves the explicit all-event subscription metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The fromAllEvents metadata, or undefined if not decorated.
 */
export function getFromAllEventsMetadata(target: object, propertyKey: string): FromAllEventsMetadata | undefined {
    return getPropertyMetadata<FromAllEventsMetadata>(METADATA_KEY, target, propertyKey);
}
