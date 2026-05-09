// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Unique identifier for a read model.
 */
export class ReadModelId {
    constructor(readonly value: string) {}

    /** @inheritdoc */
    toString(): string {
        return this.value;
    }
}
