// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when the {@link encrypted} decorator is applied to the `eventSourceId` property.
 */
export class EncryptedNotSupportedOnEventSourceId extends Error {
    /**
     * Initializes a new instance of the {@link EncryptedNotSupportedOnEventSourceId} class.
     * @param typeName - The name of the type the decorator was applied to.
     */
    constructor(typeName: string) {
        super(
            `The @encrypted() decorator cannot be applied to 'eventSourceId' on '${typeName}' because it is the ` +
            'event source identifier. Event source identifiers cannot be encrypted as they are required for event ' +
            'correlation. If the identifier itself is sensitive, use a non-sensitive surrogate value as the event ' +
            'source identifier and store the sensitive value in a separate property marked with @encrypted().'
        );
        this.name = 'EncryptedNotSupportedOnEventSourceId';
    }
}
