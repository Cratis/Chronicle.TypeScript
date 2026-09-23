// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a property, or the type it resolves metadata from, carries both `@pii()` and
 * `@encrypted()`.
 *
 * This is not merely redundant - it corrupts the value. The kernel applies every matching handler
 * for a property in sequence, so a value marked both ways is encrypted first under the PII key and
 * then again under the Encrypted key; releasing it decrypts with the wrong key against ciphertext,
 * which fails loudly (a padding/authentication error) rather than returning a wrong value. A value
 * needs exactly one protection: `@pii()` when it is personal data with a lawful basis for erasure,
 * `@encrypted()` when it is an operational secret with none.
 */
export class PIIAndEncryptedCombinedNotSupported extends Error {
    /**
     * Initializes a new instance of the {@link PIIAndEncryptedCombinedNotSupported} class.
     * @param property - The name of the property (or type) carrying both decorators.
     */
    constructor(property: string) {
        super(
            `'${property}' carries both @pii() and @encrypted(). A value needs exactly one protection - combining ` +
            'them would encrypt it twice, under two different keys, and it cannot be released correctly. Choose ' +
            '@pii() for personal data with a lawful basis for erasure, or @encrypted() for an operational secret ' +
            'with none.'
        );
        this.name = 'PIIAndEncryptedCombinedNotSupported';
    }
}
