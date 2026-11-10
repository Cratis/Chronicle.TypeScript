// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { setOnceExpression } from '../propertyExpressions.js';
import { decorateModelBoundProperty } from '../../types/modelBoundProperty.js';
import { ChroniclePropertyDecorator, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';

/** Metadata stored by the setFrom property decorator. */
export interface SetFromMetadata {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
    /** The event property name to read the value from. Defaults to the decorated property name. */
    readonly eventPropertyName?: string;
    /** Whether the property is only assigned while it has no value yet. */
    readonly setOnce?: boolean;
}

/** Options for the setFrom property decorator. */
export interface SetFromOptions {
    /** The event property name to read the value from. Defaults to the decorated property name. */
    readonly eventPropertyName?: string;
    /**
     * Only assign the property while it has no value yet: the first event that carries a value wins and later events
     * leave the property as it is.
     */
    readonly setOnce?: boolean;
}

const METADATA_KEY = 'chronicle:projection:setFrom';

/**
 * Property decorator that maps an event property value onto the decorated read model property.
 * @param eventType - The event constructor.
 * @param options - Options naming the event property and whether the property is only set once.
 * @returns A property decorator.
 */
export function setFrom(eventType: Function, options: SetFromOptions): ChroniclePropertyDecorator;
/**
 * Property decorator that maps an event property value onto the decorated read model property.
 * @param eventType - The event constructor.
 * @param eventPropertyName - Optional event property name. Defaults to the property name.
 * @returns A property decorator.
 */
export function setFrom(eventType: Function, eventPropertyName?: string): ChroniclePropertyDecorator;
export function setFrom(eventType: Function, eventPropertyNameOrOptions?: string | SetFromOptions): ChroniclePropertyDecorator {
    const metadata: SetFromMetadata = typeof eventPropertyNameOrOptions === 'object' && eventPropertyNameOrOptions !== null
        ? { eventType, eventPropertyName: eventPropertyNameOrOptions.eventPropertyName, ...(eventPropertyNameOrOptions.setOnce === true ? { setOnce: true } : {}) }
        : { eventType, eventPropertyName: eventPropertyNameOrOptions };
    return decorateModelBoundProperty((target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const existing: SetFromMetadata[] = Reflect.getMetadata(METADATA_KEY, target, key) ?? [];
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, key);
    });
}

/**
 * Retrieves all setFrom metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of setFrom metadata entries.
 */
export function getSetFromMetadata(target: object, propertyKey: string): SetFromMetadata[] {
    return getPropertyMetadata<SetFromMetadata[]>(METADATA_KEY, target, propertyKey) ?? [];
}

/**
 * Builds the property expression for a setFrom mapping.
 * @param mapping - The setFrom metadata.
 * @param property - The decorated read model property.
 * @returns The event property, wrapped in `$setOnce(...)` when the mapping only sets once.
 */
export function setFromExpression(mapping: SetFromMetadata, property: string): string {
    const expression = mapping.eventPropertyName ?? property;
    return mapping.setOnce === true ? setOnceExpression(expression) : expression;
}
