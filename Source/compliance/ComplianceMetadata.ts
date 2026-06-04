// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ComplianceMetadataType } from './ComplianceMetadataType';

/**
 * Represents metadata related to compliance.
 */
export interface ComplianceMetadata {
    /**
     * The type of compliance metadata.
     */
    readonly metadataType: ComplianceMetadataType;

    /**
     * Any additional details - can be empty.
     */
    readonly details: string;
}
