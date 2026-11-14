// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphViewMember } from './GraphViewMember.js';

/**
 * Represents a view over a graph as it is declared: anchored at one node label, with its members in declaration order.
 */
export interface GraphView {
    /** The name of the view, unique in its graph. */
    readonly name: string;

    /** The label of the node the view is anchored at. */
    readonly root: string;

    /** The members of the view, in the order they are declared. */
    readonly members: readonly GraphViewMember[];
}
