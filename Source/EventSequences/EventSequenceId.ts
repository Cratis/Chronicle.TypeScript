// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the unique identifier of an event sequence.
 */
export class EventSequenceId {
    /** The identifier of the default event log sequence. */
    static readonly eventLog = new EventSequenceId('00000000-0000-0000-0000-000000000000');

    constructor(readonly value: string) {}

    /** @inheritdoc */
    toString(): string {
        return this.value;
    }
}
