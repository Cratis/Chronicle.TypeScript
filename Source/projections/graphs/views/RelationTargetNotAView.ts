// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when the target of a relation is not a declared view of the graph.
 */
export class RelationTargetNotAView extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.RelationTargetNotAView;

    /**
     * Creates a new {@link RelationTargetNotAView}.
     * @param view - The view type.
     * @param member - The name of the member.
     * @param target - The type that is not a view of the graph.
     */
    constructor(view: Function, member: string, target: Function) {
        super(`The member '${member}' of the view '${view.name}' yields '${target.name}', which is not a view of the graph. Declare it with viewOf and the same graph.`);
        this.name = 'RelationTargetNotAView';
    }
}
