// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import type { EventContext } from '../../events/index.js';
import { TypeIntrospector } from '../../types/index.js';
import { eventContextPropertyExpression } from '../eventContextPropertyExpression.js';
import { setOnceExpression } from '../propertyExpressions.js';
import { decorateModelBoundProperty } from '../../types/modelBoundProperty.js';
import { ChroniclePropertyDecorator, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';

/** Metadata stored by the setFromContext property decorator. */
export interface SetFromContextMetadata {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
    /** The event context property name to read the value from. Defaults to the decorated property name. */
    readonly contextPropertyName?: string;
    /** Whether the property is only assigned while it has no value yet. */
    readonly setOnce?: boolean;
}

/** Options for the setFromContext property decorator. */
export interface SetFromContextOptions {
    /** The event context property name or accessor to read the value from. Defaults to the decorated property name. */
    readonly contextProperty?: string | PropertyAccessor<EventContext>;
    /**
     * Only assign the property while it has no value yet. Use it to capture a first occurrence - for instance
     * `@setFromContext(ItemAdded, { contextProperty: 'occurred', setOnce: true })` for when something was created -
     * without a dedicated creation event.
     */
    readonly setOnce?: boolean;
}

const METADATA_KEY = 'chronicle:projection:setFromContext';

/**
 * Property decorator that maps a value from an event context property onto the decorated read model property.
 * @param eventType - The event constructor.
 * @param contextPropertyOrAccessorOrOptions - Optional event context property name, property accessor, or options naming the
 *   context property and whether the property is only set once. Defaults to the property name.
 * @returns A property decorator.
 */
export function setFromContext(eventType: Function, contextPropertyName?: string): ChroniclePropertyDecorator;
export function setFromContext(eventType: Function, contextPropertyAccessor?: PropertyAccessor<EventContext>): ChroniclePropertyDecorator;
export function setFromContext(eventType: Function, options: SetFromContextOptions): ChroniclePropertyDecorator;
export function setFromContext(
    eventType: Function,
    contextPropertyOrAccessorOrOptions?: string | PropertyAccessor<EventContext> | SetFromContextOptions
): ChroniclePropertyDecorator {
    const options = typeof contextPropertyOrAccessorOrOptions === 'object' && contextPropertyOrAccessorOrOptions !== null
        ? contextPropertyOrAccessorOrOptions
        : undefined;
    const contextPropertyOrAccessor = options === undefined
        ? contextPropertyOrAccessorOrOptions as string | PropertyAccessor<EventContext> | undefined
        : options.contextProperty;
    return decorateModelBoundProperty((target: object, propertyKey: string | symbol) => {
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

        const metadata: SetFromContextMetadata = { eventType, contextPropertyName, ...(options?.setOnce === true ? { setOnce: true } : {}) };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    });
}

/**
 * Retrieves all setFromContext metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of setFromContext metadata entries.
 */
export function getSetFromContextMetadata(target: object, propertyKey: string): SetFromContextMetadata[] {
    return getPropertyMetadata<SetFromContextMetadata[]>(METADATA_KEY, target, propertyKey) ?? [];
}

/**
 * Builds the property expression for a setFromContext mapping.
 * @param mapping - The setFromContext metadata.
 * @param property - The decorated read model property.
 * @returns The `$eventContext(...)` expression, wrapped in `$setOnce(...)` when the mapping only sets once.
 */
export function setFromContextExpression(mapping: SetFromContextMetadata, property: string): string {
    const expression = eventContextPropertyExpression(mapping.contextPropertyName ?? property);
    return mapping.setOnce === true ? setOnceExpression(expression) : expression;
}
