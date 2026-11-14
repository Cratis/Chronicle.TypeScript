// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphEdgeDirection } from './GraphEdgeDirection.js';
import type { GraphViewCardinality } from './GraphViewCardinality.js';
import type { GraphViewMemberKind } from './GraphViewMemberKind.js';

/**
 * Represents a member of a view that follows one edge type in one direction to a nested view.
 */
export interface GraphViewRelationMember {
    /** The name of the member. */
    readonly name: string;

    /** The kind of the member. */
    readonly kind: GraphViewMemberKind.Relation;

    /** The edge type that is followed, for example MEMBER_OF. */
    readonly edge: string;

    /** The direction in which the edge is followed, seen from the root node of the view. */
    readonly direction: GraphEdgeDirection;

    /** Whether the relation yields a list or a single item. */
    readonly cardinality: GraphViewCardinality;

    /** The name of the nested view. */
    readonly view: string;
}
