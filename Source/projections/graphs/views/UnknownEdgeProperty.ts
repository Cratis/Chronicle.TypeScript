// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when an edge property member of a view names a property the edge does not declare.
 */
export class UnknownEdgeProperty extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.UnknownEdgeProperty;

    /**
     * Creates a new {@link UnknownEdgeProperty}.
     * @param view - The view type.
     * @param member - The name of the member.
     * @param edge - The edge type that is followed to reach the view.
     * @param source - The name of the property that is not declared.
     */
    constructor(view: Function, member: string, edge: string, source: string) {
        super(`The member '${member}' of the view '${view.name}' reads '${source}', which is not a property of the edge '${edge}'.`);
        this.name = 'UnknownEdgeProperty';
    }
}
