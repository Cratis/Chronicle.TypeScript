// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when a view with edge property members is the target of relations of more than one edge type.
 */
export class EdgePropertyViewSharedAcrossEdges extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.EdgePropertyViewSharedAcrossEdges;

    /**
     * Creates a new {@link EdgePropertyViewSharedAcrossEdges}.
     * @param view - The view type.
     * @param edges - The edge types of the relations that yield the view.
     */
    constructor(view: Function, edges: readonly string[]) {
        super(`The view '${view.name}' has members that read edge properties, but relations of more than one edge type yield it (${edges.join(', ')}). Use one view per edge type.`);
        this.name = 'EdgePropertyViewSharedAcrossEdges';
    }
}
