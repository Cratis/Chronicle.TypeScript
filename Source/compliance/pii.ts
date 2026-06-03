// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { ComplianceMetadata } from './ComplianceMetadata';
import { ComplianceMetadataType } from './ComplianceMetadataType';
import { TypeIntrospector } from '../types';

/** Metadata key for PII decorator. */
const PII_METADATA_KEY = 'chronicle:compliance:pii';

/**
 * Property decorator that marks a property as containing Personal Identifiable Information (PII)
 * according to the GDPR definition. When applied to read model properties, the Chronicle Kernel
 * will encrypt the property values using compliance-aware encryption.
 *
 * @param details - Optional details explaining why or to what extent the property is classified as PII.
 * @returns A property decorator.
 *
 * @example
 * ```typescript
 * @readModel()
 * class Employee {
 *     @pii('Employee social security number')
 *     ssn: string = '';
 *
 *     @pii('Personal email address')
 *     email: string = '';
 *
 *     @pii()
 *     phoneNumber: string = '';
 * }
 * ```
 */
export function pii(details?: string): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const metadata: ComplianceMetadata = {
            metadataType: ComplianceMetadataType.PII,
            details: details ?? ''
        };
        Reflect.defineMetadata(PII_METADATA_KEY, metadata, target, key);
    };
}

/**
 * Gets the PII compliance metadata for a property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The compliance metadata, or undefined if not decorated with @pii.
 */
export function getPIIMetadata(target: object, propertyKey: string): ComplianceMetadata | undefined {
    return Reflect.getMetadata(PII_METADATA_KEY, target, propertyKey);
}

/**
 * Checks whether a property has been decorated with @pii.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns True if the property has @pii decorator; false otherwise.
 */
export function hasPIIMetadata(target: object, propertyKey: string): boolean {
    return Reflect.hasMetadata(PII_METADATA_KEY, target, propertyKey);
}
