// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { ComplianceMetadata } from './ComplianceMetadata';
import { ComplianceMetadataType } from './ComplianceMetadataType';
import { TypeIntrospector } from '../types';

/** Metadata key for PII decorator on properties. */
const PII_PROPERTY_METADATA_KEY = 'chronicle:compliance:pii:property';

/** Metadata key for PII decorator on types. */
const PII_TYPE_METADATA_KEY = 'chronicle:compliance:pii:type';

/**
 * Decorator that marks a property or type as containing Personal Identifiable Information (PII)
 * according to the GDPR definition. When applied to read model properties or ConceptAs types,
 * the Chronicle Kernel will encrypt the values using compliance-aware encryption.
 *
 * @param details - Optional details explaining why or to what extent the property/type is classified as PII.
 * @returns A property decorator or class decorator.
 *
 * @example
 * Property usage:
 * ```typescript
 * @readModel()
 * class Employee {
 *     @pii('Employee social security number')
 *     ssn: string = '';
 *
 *     @pii('Personal email address')
 *     email: string = '';
 * }
 * ```
 *
 * @example
 * Type usage with ConceptAs:
 * ```typescript
 * @pii('Customer email address')
 * class CustomerEmailConcept extends ConceptAs<string> {}
 * export type CustomerEmail = CustomerEmailConcept | string;
 * 
 * @readModel()
 * class Customer {
 *     @field(CustomerEmailConcept)
 *     email: CustomerEmail = '';
 * }
 * ```
 */
export function pii(details?: string): PropertyDecorator & ClassDecorator {
    return (target: object | Function, propertyKey?: string | symbol) => {
        // Class decorator usage (for types like ConceptAs)
        if (typeof target === 'function' && propertyKey === undefined) {
            const metadata: ComplianceMetadata = {
                metadataType: ComplianceMetadataType.PII,
                details: details ?? ''
            };
            Reflect.defineMetadata(PII_TYPE_METADATA_KEY, metadata, target);
            return;
        }

        // Property decorator usage
        if (propertyKey !== undefined) {
            const key = propertyKey.toString();
            TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
            const metadata: ComplianceMetadata = {
                metadataType: ComplianceMetadataType.PII,
                details: details ?? ''
            };
            Reflect.defineMetadata(PII_PROPERTY_METADATA_KEY, metadata, target, key);
        }
    };
}

/**
 * Gets the PII compliance metadata for a property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The compliance metadata, or undefined if not decorated with @pii.
 */
export function getPIIMetadata(target: object, propertyKey: string): ComplianceMetadata | undefined {
    return Reflect.getMetadata(PII_PROPERTY_METADATA_KEY, target, propertyKey);
}

/**
 * Checks whether a property has been decorated with @pii.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns True if the property has @pii decorator; false otherwise.
 */
export function hasPIIMetadata(target: object, propertyKey: string): boolean {
    return Reflect.hasMetadata(PII_PROPERTY_METADATA_KEY, target, propertyKey);
}

/**
 * Gets the PII compliance metadata for a type.
 * @param type - The type constructor.
 * @returns The compliance metadata, or undefined if not decorated with @pii.
 */
export function getTypePIIMetadata(type: Function): ComplianceMetadata | undefined {
    return Reflect.getMetadata(PII_TYPE_METADATA_KEY, type);
}

/**
 * Checks whether a type has been decorated with @pii.
 * @param type - The type constructor.
 * @returns True if the type has @pii decorator; false otherwise.
 */
export function isPII(type: Function): boolean {
    return Reflect.hasMetadata(PII_TYPE_METADATA_KEY, type);
}
