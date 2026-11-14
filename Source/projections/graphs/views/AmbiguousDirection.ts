// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when a relation follows an edge that starts and ends at the same label without saying in which direction.
 */
export class AmbiguousDirection extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.AmbiguousDirection;

    /**
     * Creates a new {@link AmbiguousDirection}.
     * @param view - The view type.
     * @param member - The name of the member.
     * @param edge - The edge type.
     */
    constructor(view: Function, member: string, edge: string) {
        super(`The member '${member}' of the view '${view.name}' follows '${edge}', which starts and ends at the same label. State the direction.`);
        this.name = 'AmbiguousDirection';
    }
}
