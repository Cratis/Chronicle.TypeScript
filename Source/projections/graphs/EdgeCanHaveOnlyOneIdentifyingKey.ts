// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when an edge type has more than one identifying key.
 */
export class EdgeCanHaveOnlyOneIdentifyingKey extends Error {
    /**
     * Creates a new {@link EdgeCanHaveOnlyOneIdentifyingKey}.
     * @param type - The edge type.
     */
    constructor(type: Function) {
        super(`The edge type '${type.name}' can have at most one member with the graphKey decorator, the one that identifies the edge.`);
        this.name = 'EdgeCanHaveOnlyOneIdentifyingKey';
    }
}
