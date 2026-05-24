// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';

/**
 * Represents a correlation identifier used to track operations across call boundaries.
 */
export class CorrelationId {
    /**
     * A well-known {@link CorrelationId} representing an unset/empty value.
     */
    static readonly notSet = new CorrelationId('00000000-0000-0000-0000-000000000000');

    /**
     * Creates a new unique {@link CorrelationId}.
     * @returns A new {@link CorrelationId} backed by a freshly generated GUID.
     */
    static create(): CorrelationId {
        return new CorrelationId(Guid.create().toString());
    }

    /**
     * Initializes a new instance of the {@link CorrelationId} class.
     * @param value - The string value of the correlation identifier.
     */
    constructor(readonly value: string) {}

    /** @inheritdoc */
    toString(): string {
        return this.value;
    }
}
