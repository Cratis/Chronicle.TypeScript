// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines a manager for working with Personal Identifiable Information (PII) compliance concerns.
 */
export interface IPIIManager {
    /**
     * Deletes the encryption key for a given PII encryption key identifier, effectively performing
     * a GDPR right-to-erasure for all data encrypted with that key.
     * @param identifier - The identifier of the encryption key to delete.
     * @remarks
     * Once the encryption key is deleted, any data encrypted with it can no longer be decrypted -
     * this operation cannot be undone.
     */
    deleteEncryptionKey(identifier: string): Promise<void>;
}
