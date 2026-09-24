// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { SecurityMetadata } from './SecurityMetadata.js';
import { getEncryptedMetadata, getTypeEncryptedMetadata } from './encrypted.js';

/**
 * Resolves security metadata for properties and types.
 *
 * This is the security counterpart to {@link ComplianceMetadataResolver} - a deliberately separate
 * type rather than a shared one. See {@link SecurityMetadataType} for why.
 */
export class SecurityMetadataResolver {
    /**
     * Checks if a property has security metadata.
     * @param target - The class prototype.
     * @param propertyKey - The property name.
     * @returns True if the property has security metadata; false otherwise.
     */
    static hasMetadataFor(target: object, propertyKey: string): boolean {
        return getEncryptedMetadata(target, propertyKey) !== undefined;
    }

    /**
     * Gets all security metadata for a property.
     * @param target - The class prototype.
     * @param propertyKey - The property name.
     * @returns Array of security metadata.
     */
    static getMetadataFor(target: object, propertyKey: string): SecurityMetadata[] {
        const metadata: SecurityMetadata[] = [];

        const encryptedMetadata = getEncryptedMetadata(target, propertyKey);
        if (encryptedMetadata) {
            metadata.push(encryptedMetadata);
        }

        return metadata;
    }

    /**
     * Gets security metadata for a type (e.g., ConceptAs types).
     * @param type - The type constructor.
     * @returns Array of security metadata.
     */
    static getMetadataForType(type: Function): SecurityMetadata[] {
        const metadata: SecurityMetadata[] = [];
        const encryptedMetadata = getTypeEncryptedMetadata(type);
        if (encryptedMetadata) {
            metadata.push(encryptedMetadata);
        }
        return metadata;
    }
}
