// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { decorateModelBoundProperty } from '../../types/modelBoundProperty.js';
import { ChroniclePropertyDecorator, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';
import type { FromAllEventsMetadata } from './FromAllEventsMetadata.js';

const METADATA_KEY = 'chronicle:projection:fromAllEvents';

/**
 * On a root property, subscribes the projection to every event type, including events not declared
 * with `fromEvent`. The model has one shared All block: opting in makes every root
 * `@fromEvery`/`@fromAll` mapping (including inherited ones) an all-event mapping that also applies
 * to children. Restricted and all-event shared mappings cannot be mixed in one model.
 * `@fromEvery`/`@fromAll` mappings on child or nested types are not collected, unlike .NET,
 * which also collects child [FromEvery] mappings.
 * On a child or nested member, contributes its bare property name to the root All block and sets
 * IncludeChildren for the shared block, including the root's restricted shared mappings, without
 * widening the root subscription. With kernel 19.26.2, when the child's creating event is explicitly
 * subscribed at the root, it updates the root's shared mappings and creates the child without
 * populating its shared mapped values. Opt into `@fromAllEvents` at the root to populate child values
 * in this case. Takes precedence over `fromEvery` and the deprecated `fromAll` alias on the same property.
 * Opting in changes the definition and may trigger replay; unrelated events can create rows or clear
 * mapped properties. Use `fromEvery` without `fromAllEvents` on the model or its children to keep
 * shared mappings restricted to already-subscribed events and the root.
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
