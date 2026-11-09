// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when two declarations produce a graph with the same name.
 */
export class GraphDeclaredMoreThanOnce extends Error {
    /**
     * Creates a new {@link GraphDeclaredMoreThanOnce}.
     * @param graph - The name of the graph.
     */
    constructor(graph: string) {
        super(`The graph '${graph}' is declared by more than one graph projection. A graph is the read model of exactly one projection.`);
        this.name = 'GraphDeclaredMoreThanOnce';
    }
}
