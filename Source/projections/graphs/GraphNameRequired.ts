// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a model-bound node or edge does not say which graph it belongs to.
 */
export class GraphNameRequired extends Error {
    /**
     * Creates a new {@link GraphNameRequired}.
     * @param type - The node or edge type.
     */
    constructor(type: Function) {
        super(`The type '${type.name}' is a node or an edge but does not name its graph. Put the graph decorator on it, for example @graph('Organization').`);
        this.name = 'GraphNameRequired';
    }
}
