// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the kind of a member of a graph view.
 */
export enum GraphViewMemberKind {
    /** A property of the root node. */
    Property = 'property',

    /** A relation that follows one declared edge type in one direction to a nested view. */
    Relation = 'relation',

    /** A property of the edge that was followed to reach the view. */
    EdgeProperty = 'edgeProperty'
}
