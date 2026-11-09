// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when an edge connects a type that is not a node of its graph.
 */
export class UnknownGraphNode extends Error {
    /**
     * Creates a new {@link UnknownGraphNode}.
     * @param edgeType - The edge type.
     * @param node - The type that is not a node of the graph.
     */
    constructor(edgeType: string, node: Function) {
        super(`The edge '${edgeType}' connects '${node.name}', which is not a node of the graph.`);
        this.name = 'UnknownGraphNode';
    }
}
