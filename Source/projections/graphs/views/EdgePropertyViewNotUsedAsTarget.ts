// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when a view with edge property members is not the target of any relation.
 */
export class EdgePropertyViewNotUsedAsTarget extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.EdgePropertyViewNotUsedAsTarget;

    /**
     * Creates a new {@link EdgePropertyViewNotUsedAsTarget}.
     * @param view - The view type.
     */
    constructor(view: Function) {
        super(`The view '${view.name}' has members that read edge properties, but no relation yields it, so there is no edge to read them from.`);
        this.name = 'EdgePropertyViewNotUsedAsTarget';
    }
}
