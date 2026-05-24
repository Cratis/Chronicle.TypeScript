// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import type { EventContext } from '../../Events';
import { TypeIntrospector } from '../../types';

/** Metadata stored by the setFromContext property decorator. */
export interface SetFromContextMetadata {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
    /** The event context property name to read the value from. Defaults to the decorated property name. */
    readonly contextPropertyName?: string;
}

const METADATA_KEY = 'chronicle:projection:setFromContext';

/**
 * Property decorator that maps a value from an event context property onto the decorated read model property.
 * @param eventType - The event constructor.
 * @param contextPropertyOrAccessor - Optional event context property name or property accessor. Defaults to the property name.
 * @returns A property decorator.
 */
export function setFromContext(eventType: Function, contextPropertyName?: string): PropertyDecorator;
export function setFromContext(eventType: Function, contextPropertyAccessor?: PropertyAccessor<EventContext>): PropertyDecorator;
export function setFromContext(
    eventType: Function,
    contextPropertyOrAccessor?: string | PropertyAccessor<EventContext>
): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const existing: SetFromContextMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];

        let contextPropertyName: string | undefined;
        if (typeof contextPropertyOrAccessor === 'string') {
            contextPropertyName = contextPropertyOrAccessor;
        } else if (typeof contextPropertyOrAccessor === 'function') {
            const handler = new PropertyPathResolverProxyHandler();
            const proxy = new Proxy({}, handler);
            contextPropertyOrAccessor(proxy as EventContext);
            contextPropertyName = handler.property;
        }

        const metadata: SetFromContextMetadata = { eventType, contextPropertyName };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    };
}

/**
 * Retrieves all setFromContext metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of setFromContext metadata entries.
 */
export function getSetFromContextMetadata(target: object, propertyKey: string): SetFromContextMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target, propertyKey) ?? [];
}
