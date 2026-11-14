// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphEdgeDirection } from './GraphEdgeDirection.js';
import type { GraphViewCardinality } from './GraphViewCardinality.js';

/** Options of the follows decorator. */
export interface FollowsOptions {
    /**
     * Whether the relation yields a list or a single item. TypeScript erases generic arguments, so the type of the
     * member cannot say which one it is. Defaults to {@link GraphViewCardinality.Many}.
     */
    readonly cardinality?: GraphViewCardinality;

    /**
     * The direction in which the edge is followed. It is derived from the labels of the edge, except for an edge
     * that starts and ends at the same label, which needs it to be stated.
     */
    readonly direction?: GraphEdgeDirection;
}
