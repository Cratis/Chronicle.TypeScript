// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { GraphViewDefinition } from './GraphViewDefinition.js';

/**
 * Represents the outcome of building the views of one graph.
 */
export interface GraphViewBuildResult {
    /**
     * The definition of the views. It is missing when any view of the graph is invalid: a view can be read only
     * together with the views it nests, so the views of a graph are emitted together or not at all.
     */
    readonly definition?: GraphViewDefinition;

    /** The views that are invalid, and why. The error of each carries the reason code. */
    readonly failures: ReadonlyMap<Constructor, Error>;
}
