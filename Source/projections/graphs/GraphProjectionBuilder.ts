// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { GraphEdgeBuilder } from './GraphEdgeBuilder.js';
import type { GraphEdgeModel } from './GraphEdgeModel.js';
import { GraphNodeBuilder } from './GraphNodeBuilder.js';
import type { GraphModel } from './GraphModel.js';
import type { GraphNodeModel } from './GraphNodeModel.js';
import type { IGraphEdgeBuilder } from './IGraphEdgeBuilder.js';
import type { IGraphNodeBuilder } from './IGraphNodeBuilder.js';
import type { IGraphProjection } from './IGraphProjection.js';
import type { IGraphProjectionBuilder } from './IGraphProjectionBuilder.js';

/**
 * Implements {@link IGraphProjectionBuilder}, collecting the nodes and edges a graph projection defines.
 */
export class GraphProjectionBuilder implements IGraphProjectionBuilder {
    private readonly _nodes: GraphNodeModel[] = [];
    private readonly _edges: GraphEdgeModel[] = [];

    /** @inheritdoc */
    node<TNode>(nodeType: Constructor<TNode>, configure: (builder: IGraphNodeBuilder<TNode>) => void): IGraphProjectionBuilder {
        const builder = new GraphNodeBuilder<TNode>(nodeType);
        configure(builder);
        this._nodes.push(builder.build());
        return this;
    }

    /** @inheritdoc */
    edge<TEdge>(
        edgeType: Constructor<TEdge>,
        sourceType: Function,
        targetType: Function,
        configure: (builder: IGraphEdgeBuilder<TEdge>) => void): IGraphProjectionBuilder {
        const builder = new GraphEdgeBuilder<TEdge>(edgeType, sourceType, targetType);
        configure(builder);
        this._edges.push(builder.build());
        return this;
    }

    /**
     * Builds the {@link GraphModel} of a graph projection.
     * @param name - The name of the graph.
     * @param projection - The graph projection to define the model with.
     * @returns The model.
     */
    build(name: string, projection: IGraphProjection): GraphModel {
        projection.define(this);
        return { name, nodes: this._nodes, edges: this._edges };
    }
}
