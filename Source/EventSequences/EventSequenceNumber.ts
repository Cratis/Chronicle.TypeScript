// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the sequence number of an event within an event sequence.
 */
export class EventSequenceNumber {
    /** Represents the first possible sequence number. */
    static readonly first = new EventSequenceNumber(0);

    /** Represents an unset sequence number. */
    static readonly unset = new EventSequenceNumber(Number.MAX_SAFE_INTEGER);

    constructor(readonly value: number) {}

    /**
     * Determines whether this sequence number comes before another.
     * @param other - The other sequence number to compare with.
     * @returns True if this sequence number is before the other.
     */
    isBefore(other: EventSequenceNumber): boolean {
        return this.value < other.value;
    }

    /**
     * Determines whether this sequence number comes after another.
     * @param other - The other sequence number to compare with.
     * @returns True if this sequence number is after the other.
     */
    isAfter(other: EventSequenceNumber): boolean {
        return this.value > other.value;
    }

    /** @inheritdoc */
    toString(): string {
        return this.value.toString();
    }
}
