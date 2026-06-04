// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';

/**
 * Represents a type of compliance metadata.
 */
export class ComplianceMetadataType {
    /**
     * Personal Identifiable Information according to the definition in GDPR.
     */
    static readonly PII = new ComplianceMetadataType('cae5580e-83d6-44dc-9d7a-a72e8a2f17d7');

    private readonly _value: Guid;

    /**
     * Initializes a new instance of ComplianceMetadataType.
     * @param value - The GUID value of the compliance metadata type.
     */
    constructor(value: string | Guid) {
        this._value = typeof value === 'string' ? Guid.parse(value) : value;
    }

    /**
     * Gets the underlying GUID value.
     */
    get value(): Guid {
        return this._value;
    }

    /**
     * Returns the string representation of the compliance metadata type.
     */
    toString(): string {
        return this._value.toString();
    }
}
