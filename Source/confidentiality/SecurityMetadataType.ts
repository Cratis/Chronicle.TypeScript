// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a type of security metadata.
 *
 * This is the security counterpart to {@link ComplianceMetadataType} - a deliberately separate type
 * rather than a shared one. A `@pii()` value and an `@encrypted()` value are never the same kind of
 * thing: one is personal data with a GDPR erasure obligation, the other is an operational secret
 * with none. Keeping the two vocabularies apart keeps that distinction visible at every call site
 * that reads a schema's metadata.
 */
export class SecurityMetadataType {
    /**
     * The key is provisioned per compliance identity - the same identity, resolved the same way, a
     * `@pii()` value on the same document would use. This is what `@encrypted()` (with no explicit
     * scope, or `EncryptionScope.Subject`) resolves to.
     */
    static readonly EncryptedSubject = new SecurityMetadataType('EncryptedSubject');

    /**
     * The key is provisioned once per event store namespace. This is what
     * `@encrypted(EncryptionScope.Namespace)` resolves to.
     */
    static readonly EncryptedNamespace = new SecurityMetadataType('EncryptedNamespace');

    /**
     * The key is provisioned once for the whole Chronicle installation. This is what
     * `@encrypted(EncryptionScope.Global)` resolves to.
     */
    static readonly EncryptedGlobal = new SecurityMetadataType('EncryptedGlobal');

    private readonly _value: string;

    /**
     * Initializes a new instance of SecurityMetadataType.
     * @param value - The string value of the security metadata type.
     */
    constructor(value: string) {
        this._value = value;
    }

    /**
     * Gets the underlying string value.
     */
    get value(): string {
        return this._value;
    }

    /**
     * Returns the string representation of the security metadata type.
     */
    toString(): string {
        return this._value;
    }
}
