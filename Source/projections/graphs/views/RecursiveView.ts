// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewReason } from './GraphViewReason.js';

/**
 * Error raised when a view contains itself, directly or transitively.
 */
export class RecursiveView extends Error {
    /** The stable reason code of the rule that was broken. */
    readonly reason = GraphViewReason.RecursiveView;

    /**
     * Creates a new {@link RecursiveView}.
     * @param view - The view type.
     * @param path - The names of the views that make the cycle, starting and ending with the view.
     */
    constructor(view: Function, path: readonly string[]) {
        super(`The view '${view.name}' contains itself: ${path.join(' -> ')}. Nesting must be finite.`);
        this.name = 'RecursiveView';
    }
}
