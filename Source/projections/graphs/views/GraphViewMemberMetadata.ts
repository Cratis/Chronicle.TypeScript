// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphEdgeDirection } from './GraphEdgeDirection.js';
import type { GraphViewCardinality } from './GraphViewCardinality.js';
import type { GraphViewEdgeReference } from './GraphViewEdgeReference.js';
import type { GraphViewMemberKind } from './GraphViewMemberKind.js';

/** Metadata stored by the member decorators of a graph view. */
export interface GraphViewMemberMetadata {
    /** The kind of the member. */
    readonly kind: GraphViewMemberKind;

    /** Whether the member is bound to the key of the root node. */
    readonly isKey: boolean;

    /** The name of the property of the node or edge the member reads. When missing, the name of the member is used. */
    readonly source?: string;

    /** The edge a relation follows. */
    readonly edge?: GraphViewEdgeReference;

    /** A function returning the class of the view a relation yields. */
    readonly view?: () => Function;

    /** The explicit direction of a relation. When missing, it is derived from the labels of the edge. */
    readonly direction?: GraphEdgeDirection;

    /** The cardinality of a relation. */
    readonly cardinality?: GraphViewCardinality;
}
