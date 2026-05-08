// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the name of an event store.
 */
export class EventStoreName {
    constructor(readonly value: string) {}

    /** @inheritdoc */
    toString(): string {
        return this.value;
    }
}
