// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the name of a namespace within an event store.
 */
export class EventStoreNamespaceName {
    /** The default namespace name. */
    static readonly default = new EventStoreNamespaceName('Default');

    constructor(readonly value: string) {}

    /** @inheritdoc */
    toString(): string {
        return this.value;
    }
}
