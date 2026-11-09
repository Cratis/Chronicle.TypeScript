// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a graph has two nodes with the same label or two edges of the same type.
 */
export class GraphHasDuplicateElement extends Error {
    /**
     * Creates a new {@link GraphHasDuplicateElement}.
     * @param graph - The name of the graph.
     * @param kind - Either node or edge.
     * @param name - The label or type.
     */
    constructor(graph: string, kind: string, name: string) {
        super(`The graph '${graph}' declares the ${kind} '${name}' more than once.`);
        this.name = 'GraphHasDuplicateElement';
    }
}
