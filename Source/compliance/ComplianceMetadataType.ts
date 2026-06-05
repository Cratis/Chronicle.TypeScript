// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a type of compliance metadata.
 */
export class ComplianceMetadataType {
    /**
     * Personal Identifiable Information according to the definition in GDPR.
     */
    static readonly PII = new ComplianceMetadataType('PII');

    private readonly _value: string;

    /**
     * Initializes a new instance of ComplianceMetadataType.
     * @param value - The string value of the compliance metadata type.
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
     * Returns the string representation of the compliance metadata type.
     */
    toString(): string {
        return this._value;
    }
}
