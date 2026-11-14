// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when a relation follows an edge that does not start or end at the root of the view.
 */
export class EdgeNotIncidentOnRoot extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.EdgeNotIncidentOnRoot;

    /**
     * Creates a new {@link EdgeNotIncidentOnRoot}.
     * @param view - The view type.
     * @param member - The name of the member.
     * @param edge - The edge type.
     * @param root - The label of the root of the view.
     */
    constructor(view: Function, member: string, edge: string, root: string) {
        super(`The member '${member}' of the view '${view.name}' follows '${edge}' in a direction that does not start at '${root}', the root of the view.`);
        this.name = 'EdgeNotIncidentOnRoot';
    }
}
