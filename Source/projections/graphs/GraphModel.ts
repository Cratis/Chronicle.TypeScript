// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphEdgeModel } from './GraphEdgeModel.js';
import type { GraphNodeModel } from './GraphNodeModel.js';

/**
 * Represents a graph as declared by the decorators or by the fluent builder, before it is turned into the
 * definitions that are registered. Both forms produce this model, which is what makes them produce identical definitions.
 */
export interface GraphModel {
    /** The name of the graph. */
    readonly name: string;

    /** The nodes. */
    readonly nodes: readonly GraphNodeModel[];

    /** The edges. */
    readonly edges: readonly GraphEdgeModel[];
}
