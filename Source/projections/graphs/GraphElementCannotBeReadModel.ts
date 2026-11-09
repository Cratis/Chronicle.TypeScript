// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a node or an edge is also declared as a read model with the fromEvent decorator.
 */
export class GraphElementCannotBeReadModel extends Error {
    /**
     * Creates a new {@link GraphElementCannotBeReadModel}.
     * @param type - The type.
     */
    constructor(type: Function) {
        super(`The type '${type.name}' is a node or an edge in a graph and cannot also be a read model.`);
        this.name = 'GraphElementCannotBeReadModel';
    }
}
