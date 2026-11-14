// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphViewMemberKind } from './GraphViewMemberKind.js';

/**
 * Represents a member of a view that reads a property of the root node, or of the edge that was followed.
 */
export interface GraphViewPropertyMember {
    /** The name of the member. */
    readonly name: string;

    /** The kind of the member: a property of the node, or a property of the edge. */
    readonly kind: GraphViewMemberKind.Property | GraphViewMemberKind.EdgeProperty;

    /** The name of the property of the node or edge that is read. */
    readonly source: string;
}
