// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when the root of the target view of a relation is not the label at the far end of the edge.
 */
export class TargetLabelMismatch extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.TargetLabelMismatch;

    /**
     * Creates a new {@link TargetLabelMismatch}.
     * @param view - The view type.
     * @param member - The name of the member.
     * @param target - The target view type.
     * @param expected - The label at the far end of the edge.
     * @param actual - The label of the root of the target view.
     */
    constructor(view: Function, member: string, target: Function, expected: string, actual: string) {
        super(`The member '${member}' of the view '${view.name}' reaches '${expected}', but the view '${target.name}' is anchored at '${actual}'.`);
        this.name = 'TargetLabelMismatch';
    }
}
