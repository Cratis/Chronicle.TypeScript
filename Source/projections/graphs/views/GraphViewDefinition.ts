// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphView } from './GraphView.js';
import type { GraphViewSchema } from './GraphViewSchema.js';

/**
 * Represents the views declared over a graph. It is the transport and conformance form of the views, shared by the
 * Cratis clients: it is emitted from the declarations, never written by hand.
 */
export interface GraphViewDefinition {
    /** The name of the graph the views read. */
    readonly graph: string;

    /** The nodes and edges the views were validated against. It is written only when the serializer is asked to. */
    readonly schema?: GraphViewSchema;

    /** The views, sorted by name. */
    readonly views: readonly GraphView[];
}
