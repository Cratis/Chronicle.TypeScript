// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphViewSchemaEdge } from './GraphViewSchemaEdge.js';
import type { GraphViewSchemaNode } from './GraphViewSchemaNode.js';

/** Represents the nodes and edges of the graph the views were validated against. */
export interface GraphViewSchema {
    /** The nodes. */
    readonly nodes: readonly GraphViewSchemaNode[];

    /** The edges. */
    readonly edges: readonly GraphViewSchemaEdge[];
}
