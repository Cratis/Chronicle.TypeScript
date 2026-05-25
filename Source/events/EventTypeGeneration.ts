// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the generation of an event type.
 */
export class EventTypeGeneration {
    /** The first generation value. */
    static readonly firstValue = 1;

    /** The first generation of any event type. */
    static readonly first = new EventTypeGeneration(EventTypeGeneration.firstValue);

    constructor(readonly value: number) {}

    /** @inheritdoc */
    toString(): string {
        return this.value.toString();
    }
}
