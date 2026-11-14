// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when a relation of a view names an edge type the graph does not declare.
 */
export class UnknownEdge extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.UnknownEdge;

    /**
     * Creates a new {@link UnknownEdge}.
     * @param view - The view type.
     * @param member - The name of the member.
     * @param edge - The edge that is not declared.
     */
    constructor(view: Function, member: string, edge: string) {
        super(`The member '${member}' of the view '${view.name}' follows '${edge}', which is not an edge of the graph.`);
        this.name = 'UnknownEdge';
    }
}
