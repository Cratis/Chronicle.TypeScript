// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the unique identifier for an event type.
 */
export class EventTypeId {
    /**
     * Represents an unknown event type identifier.
     */
    static readonly unknown = new EventTypeId('00000000-0000-0000-0000-000000000000');

    constructor(readonly value: string) {}

    /** @inheritdoc */
    toString(): string {
        return this.value;
    }
}
