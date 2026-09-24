// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { SecurityMetadata } from './SecurityMetadata.js';
import { SecurityMetadataType } from './SecurityMetadataType.js';
import { EncryptionScope } from './EncryptionScope.js';
import { EncryptedNotSupportedOnEventSourceId } from './EncryptedNotSupportedOnEventSourceId.js';
import { TypeIntrospector } from '../types/index.js';
import { ChronicleClassOrPropertyDecorator, decorateClassOrProperty, getPropertyMetadata, hasPropertyMetadata } from '../types/propertyDecoratorMetadata.js';

/** The property name this client uses everywhere for the event source identifier. */
const EVENT_SOURCE_ID_PROPERTY = 'eventSourceId';

/** Metadata key for the encrypted decorator on properties. */
const ENCRYPTED_PROPERTY_METADATA_KEY = 'chronicle:security:encrypted:property';

/** Metadata key for the encrypted decorator on types. */
const ENCRYPTED_TYPE_METADATA_KEY = 'chronicle:security:encrypted:type';

function metadataTypeFor(scope: EncryptionScope): SecurityMetadataType {
    switch (scope) {
        case EncryptionScope.Subject:
            return SecurityMetadataType.EncryptedSubject;
        case EncryptionScope.Namespace:
            return SecurityMetadataType.EncryptedNamespace;
        case EncryptionScope.Global:
            return SecurityMetadataType.EncryptedGlobal;
    }
}

/**
 * Decorator that marks a property or type as needing plain-confidentiality encryption at rest - a
 * security measure, not a compliance one.
 *
 * Use `@encrypted()` for an operational secret that has no data subject and no lawful basis for
 * erasure - an API key, a webhook signing secret, a partner credential. Use `@pii()` instead when
 * the value is personal data about a natural person: only `@pii()` encrypts a value *and* enrolls it
 * in GDPR right-to-erasure. Marking a secret `@pii()` would make it erasable on a request that was
 * never about it; marking personal data `@encrypted()` would encrypt it but never erase it. The two
 * are not interchangeable, and this decorator's key is never provisioned under the same identity a
 * `@pii()` value for the same subject uses.
 *
 * All three {@link EncryptionScope} members are honored by the kernel: `EncryptionScope.Subject`
 * (the default) provisions a key per compliance identity, exactly matching how a `@pii()` value on
 * the same document is resolved; `EncryptionScope.Namespace` provisions one key shared by every
 * value marked with it in a given event store namespace; `EncryptionScope.Global` provisions one key
 * shared across the whole installation. Choosing a wider scope is safe for `@encrypted()` in a way
 * it is not for `@pii()`, precisely because an operational secret has no data subject whose erasure
 * request the wider key could ever need to honor separately from another subject's.
 *
 * This decorator can be used in two ways:
 * - As a property decorator: `@encrypted() propertyName: type`
 * - As a class decorator: `@encrypted() class TypeName { }`
 *
 * @param scope - The {@link EncryptionScope} the key is provisioned under - defaults to `EncryptionScope.Subject`.
 * @param details - Optional details explaining why or to what purpose/extent the property/type needs encryption.
 * @returns A decorator function that can be applied to either properties or classes (but not both on the same target).
 *
 * @example
 * Property usage:
 * ```typescript
 * @readModel()
 * class PartnerIntegration {
 *     @encrypted()
 *     apiKey: string = '';
 *
 *     @encrypted(EncryptionScope.Namespace)
 *     webhookSigningSecret: string = '';
 * }
 * ```
 */
export function encrypted(scope: EncryptionScope = EncryptionScope.Subject, details?: string): ChronicleClassOrPropertyDecorator {
    return decorateClassOrProperty((target: object | Function, propertyKey?: string | symbol) => {
        // Class decorator usage (for types like ConceptAs)
        if (typeof target === 'function' && propertyKey === undefined) {
            const metadata: SecurityMetadata = {
                metadataType: metadataTypeFor(scope),
                details: details ?? ''
            };
            Reflect.defineMetadata(ENCRYPTED_TYPE_METADATA_KEY, metadata, target);
            return;
        }

        // Property decorator usage
        if (propertyKey !== undefined) {
            const key = propertyKey.toString();
            const declaringType = (target as { constructor: Function }).constructor;

            // Encrypting the event source identifier would make its own decryption key
            // unfindable - the identifier is required, in the clear, to correlate events and
            // look up the key that protects everything else. Mirrors @pii()'s
            // PIINotSupportedOnEventSourceId guard, for the same reason.
            if (key === EVENT_SOURCE_ID_PROPERTY) {
                throw new EncryptedNotSupportedOnEventSourceId(declaringType.name || 'the decorated class');
            }

            TypeIntrospector.trackProperty(declaringType, key);
            const metadata: SecurityMetadata = {
                metadataType: metadataTypeFor(scope),
                details: details ?? ''
            };
            Reflect.defineMetadata(ENCRYPTED_PROPERTY_METADATA_KEY, metadata, target, key);
        }
    });
}

/**
 * Gets the encrypted security metadata for a property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The security metadata, or undefined if not decorated with @encrypted.
 */
export function getEncryptedMetadata(target: object, propertyKey: string): SecurityMetadata | undefined {
    return getPropertyMetadata<SecurityMetadata>(ENCRYPTED_PROPERTY_METADATA_KEY, target, propertyKey);
}

/**
 * Checks whether a property has been decorated with @encrypted.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns True if the property has @encrypted decorator; false otherwise.
 */
export function hasEncryptedMetadata(target: object, propertyKey: string): boolean {
    return hasPropertyMetadata(ENCRYPTED_PROPERTY_METADATA_KEY, target, propertyKey);
}

/**
 * Gets the encrypted security metadata for a type.
 * @param type - The type constructor.
 * @returns The security metadata, or undefined if not decorated with @encrypted.
 */
export function getTypeEncryptedMetadata(type: Function): SecurityMetadata | undefined {
    return Reflect.getMetadata(ENCRYPTED_TYPE_METADATA_KEY, type);
}

/**
 * Checks whether a type has been decorated with @encrypted.
 * @param type - The type constructor.
 * @returns True if the type has @encrypted decorator; false otherwise.
 */
export function isEncrypted(type: Function): boolean {
    return Reflect.hasMetadata(ENCRYPTED_TYPE_METADATA_KEY, type);
}
