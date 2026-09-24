// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { SecurityMetadataType } from './SecurityMetadataType.js';

/**
 * Represents metadata related to security.
 *
 * This is the security counterpart to {@link ComplianceMetadata} - a deliberately separate type
 * rather than a shared one. See {@link SecurityMetadataType} for why.
 */
export interface SecurityMetadata {
    /**
     * The type of security metadata.
     */
    readonly metadataType: SecurityMetadataType;

    /**
     * Any additional details - can be empty.
     */
    readonly details: string;
}
