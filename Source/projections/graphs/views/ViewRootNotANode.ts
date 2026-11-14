// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when the root of a view is not a node declared in the graph of the view.
 */
export class ViewRootNotANode extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.ViewRootNotANode;

    /**
     * Creates a new {@link ViewRootNotANode}.
     * @param view - The view type.
     * @param graph - The name of the graph.
     * @param root - The type the view is anchored at.
     */
    constructor(view: Function, graph: string, root: Function) {
        super(`The view '${view.name}' is anchored at '${root.name}', which is not a node of the graph '${graph}'.`);
        this.name = 'ViewRootNotANode';
    }
}
