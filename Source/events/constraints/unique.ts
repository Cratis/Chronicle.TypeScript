// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ChronicleClassOrPropertyDecorator, decorateClassOrProperty, getPropertyMetadata, getTypeOrFieldMetadata } from '../../types/propertyDecoratorMetadata.js';
import { TypeIntrospector } from '../../types/TypeIntrospector.js';
import { normalizeConstraintEventSequences } from './ConstraintEventSequences.js';
import type { UniqueOptions } from './UniqueOptions.js';

const CLASS_KEY = 'chronicle:constraint:unique:class';
const PROPERTY_KEY = 'chronicle:constraint:unique:property';

interface UniqueMetadata {
    name?: string;
    message?: string;
    /** Normalized event sequence identifiers; omitted means every event sequence. */
    eventSequences?: string[];
}

/**
 * Marks an event class as unique per event source, or an event property as unique across event sources.
 * The optional name defaults to the class or property name. Like the .NET attribute, this decorator
 * does not offer ignore-casing; use a fluent constraint for case-insensitive uniqueness.
 * @param name - Optional shared constraint name.
 * @param message - Optional fixed violation message.
 * @returns A class or public instance field decorator.
 */
export function unique(name?: string, message?: string): ChronicleClassOrPropertyDecorator;
/**
 * Marks an event class as unique per event source, or an event property as unique across event sources,
 * optionally applying the constraint only to selected event sequences.
 * @param options - The constraint name, message and event sequences.
 * @returns A class or public instance field decorator.
 */
export function unique(options: UniqueOptions): ChronicleClassOrPropertyDecorator;
export function unique(nameOrOptions?: string | UniqueOptions, message?: string): ChronicleClassOrPropertyDecorator {
    const options: UniqueOptions = typeof nameOrOptions === 'object' && nameOrOptions !== null
        ? nameOrOptions
        : { name: nameOrOptions, message };
    const eventSequences = normalizeConstraintEventSequences(options.eventSequences ?? []);
    const metadata: UniqueMetadata = {
        name: options.name,
        message: options.message,
        ...(eventSequences.length > 0 ? { eventSequences } : {})
    };
    return decorateClassOrProperty((target, property) => {
        if (property !== undefined) {
            const key = property.toString();
            TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
            Reflect.defineMetadata(PROPERTY_KEY, metadata, target, key);
        } else {
            Reflect.defineMetadata(CLASS_KEY, metadata, target);
        }
    });
}

/** Gets the unique constraint declared on an event class, if present. */
export function getUniqueEventMetadata(type: Function): UniqueMetadata | undefined {
    return getTypeOrFieldMetadata<UniqueMetadata>(CLASS_KEY, type);
}

/** Gets the unique constraint declared on an event property, if present. */
export function getUniquePropertyMetadata(type: Function, property: string): UniqueMetadata | undefined {
    return getPropertyMetadata<UniqueMetadata>(PROPERTY_KEY, type.prototype, property);
}
