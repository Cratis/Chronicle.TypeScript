// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when a view type is also a node or an edge.
 */
export class ViewIsAlsoSchema extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.ViewIsAlsoSchema;

    /**
     * Creates a new {@link ViewIsAlsoSchema}.
     * @param view - The view type.
     */
    constructor(view: Function) {
        super(`The view '${view.name}' is also a node or an edge. A view is a read model over the graph and cannot be part of its schema.`);
        this.name = 'ViewIsAlsoSchema';
    }
}
