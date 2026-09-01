// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a tag associated with an event, observer, or read model.
 */
export class Tag {
    constructor(readonly value: string) {}

    /** @inheritdoc */
    toString(): string {
        return this.value;
    }
}
