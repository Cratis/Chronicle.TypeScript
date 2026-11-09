// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IGraphEdgeBuilder } from './IGraphEdgeBuilder.js';
import type { IGraphNodeBuilder } from './IGraphNodeBuilder.js';

/**
 * Defines a builder for the nodes and edges of a graph projection.
 */
export interface IGraphProjectionBuilder {
    /**
     * Defines a node.
     * @param nodeType - The class of the node. Its name is the label of the node, unless the class has the node decorator.
     * @param configure - Callback that configures the node.
     * @returns The builder for continuation.
     */
    node<TNode>(nodeType: Constructor<TNode>, configure: (builder: IGraphNodeBuilder<TNode>) => void): IGraphProjectionBuilder;

    /**
     * Defines an edge.
     * @param edgeType - The class of the edge. Its properties, apart from the ones holding the keys of the end nodes, are
     * the properties of the edge.
     * @param sourceType - The class of the node the edge starts at.
     * @param targetType - The class of the node the edge ends at.
     * @param configure - Callback that configures the edge.
     * @returns The builder for continuation.
     */
    edge<TEdge>(
        edgeType: Constructor<TEdge>,
        sourceType: Function,
        targetType: Function,
        configure: (builder: IGraphEdgeBuilder<TEdge>) => void): IGraphProjectionBuilder;
}
