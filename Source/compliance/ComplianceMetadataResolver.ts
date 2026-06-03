// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ComplianceMetadata } from './ComplianceMetadata';
import { getPIIMetadata } from './pii';

/**
 * Resolves compliance metadata for properties.
 */
export class ComplianceMetadataResolver {
    /**
     * Checks if a property has compliance metadata.
     * @param target - The class prototype.
     * @param propertyKey - The property name.
     * @returns True if the property has compliance metadata; false otherwise.
     */
    static hasMetadataFor(target: object, propertyKey: string): boolean {
        return getPIIMetadata(target, propertyKey) !== undefined;
    }

    /**
     * Gets all compliance metadata for a property.
     * @param target - The class prototype.
     * @param propertyKey - The property name.
     * @returns Array of compliance metadata.
     */
    static getMetadataFor(target: object, propertyKey: string): ComplianceMetadata[] {
        const metadata: ComplianceMetadata[] = [];
        
        const piiMetadata = getPIIMetadata(target, propertyKey);
        if (piiMetadata) {
            metadata.push(piiMetadata);
        }
        
        return metadata;
    }
}
