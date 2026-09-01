// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../types';

/** Metadata key for the subject decorator on a property. */
const SUBJECT_PROPERTY_METADATA_KEY = 'chronicle:compliance:subject:property';

/** Metadata key for the name of the subject property recorded on the declaring type. */
const SUBJECT_TYPE_METADATA_KEY = 'chronicle:compliance:subject:type';

/**
 * Decorator that marks a property as the compliance subject - the natural person whose Personal
 * Identifiable Information (PII) a read model or event carries. The subject selects which
 * encryption key protects that PII, and which key a manual release operation must use.
 *
 * Mirrors the .NET client's `SubjectAttribute`. When no property is decorated, resolvers fall
 * back to the `id` property by convention, so read models that predate this decorator keep
 * working unchanged.
 *
 * @returns A property decorator.
 *
 * @example
 * ```typescript
 * @readModel()
 * class Employee {
 *     @subject()
 *     personId: string = '';
 *
 *     @pii('Employee social security number')
 *     ssn: string = '';
 * }
 * ```
 */
export function subject(): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        const declaringType = (target as { constructor: Function }).constructor;

        TypeIntrospector.trackProperty(declaringType, key);
        Reflect.defineMetadata(SUBJECT_PROPERTY_METADATA_KEY, true, target, key);
        Reflect.defineMetadata(SUBJECT_TYPE_METADATA_KEY, key, declaringType);
    };
}

/**
 * Checks whether a property has been decorated with @subject.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns True if the property has the @subject decorator; false otherwise.
 */
export function hasSubjectMetadata(target: object, propertyKey: string): boolean {
    return Reflect.hasMetadata(SUBJECT_PROPERTY_METADATA_KEY, target, propertyKey);
}

/**
 * Gets the name of the property decorated with @subject on a type, if any.
 * @param type - The type constructor to inspect.
 * @returns The decorated property name, or undefined when no property is decorated.
 */
export function getSubjectPropertyName(type: Function): string | undefined {
    return Reflect.getMetadata(SUBJECT_TYPE_METADATA_KEY, type);
}
