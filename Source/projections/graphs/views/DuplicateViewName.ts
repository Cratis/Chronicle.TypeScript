// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when two views of a graph have the same name.
 */
export class DuplicateViewName extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.DuplicateViewName;

    /**
     * Creates a new {@link DuplicateViewName}.
     * @param view - The view type that repeats the name.
     * @param graph - The name of the graph.
     * @param name - The name of the view.
     */
    constructor(view: Function, graph: string, name: string) {
        super(`The view '${view.name}' repeats the view name '${name}' in the graph '${graph}'. Give it another name with viewOf.`);
        this.name = 'DuplicateViewName';
    }
}
