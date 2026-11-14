// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when a property member of a view names a property the root node does not declare.
 */
export class UnknownNodeProperty extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.UnknownNodeProperty;

    /**
     * Creates a new {@link UnknownNodeProperty}.
     * @param view - The view type.
     * @param member - The name of the member.
     * @param node - The label of the root node.
     * @param source - The name of the property that is not declared.
     */
    constructor(view: Function, member: string, node: string, source: string) {
        super(`The member '${member}' of the view '${view.name}' reads '${source}', which is not a property of the node '${node}'.`);
        this.name = 'UnknownNodeProperty';
    }
}
