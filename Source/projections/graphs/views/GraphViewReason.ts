// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the stable reason codes of the rules a graph view declaration must follow. Every error raised for an
 * invalid view carries one of them in its reason.
 */
export enum GraphViewReason {
    /** The root of the view is not a node declared in the graph. */
    ViewRootNotANode = 'ViewRootNotANode',

    /** A view type is also a node or an edge. */
    ViewIsAlsoSchema = 'ViewIsAlsoSchema',

    /** Two views of a graph have the same name. */
    DuplicateViewName = 'DuplicateViewName',

    /** A property member names a property the root node does not declare. */
    UnknownNodeProperty = 'UnknownNodeProperty',

    /** A relation names an edge type the graph does not declare. */
    UnknownEdge = 'UnknownEdge',

    /** An edge property member names a property the edge does not declare. */
    UnknownEdgeProperty = 'UnknownEdgeProperty',

    /** The source and the target label of the edge are both different from the label of the root of the view. */
    EdgeNotIncidentOnRoot = 'EdgeNotIncidentOnRoot',

    /** The edge is a self edge and the relation gives no explicit direction. */
    AmbiguousDirection = 'AmbiguousDirection',

    /** The root of the target view is not the label at the far end of the edge. */
    TargetLabelMismatch = 'TargetLabelMismatch',

    /** The target of a relation is not a declared view. */
    RelationTargetNotAView = 'RelationTargetNotAView',

    /** A view contains itself, directly or transitively. */
    RecursiveView = 'RecursiveView',

    /** A view with edge property members is not the target of any relation. */
    EdgePropertyViewNotUsedAsTarget = 'EdgePropertyViewNotUsedAsTarget',

    /** A view with edge property members is the target of relations of more than one edge type. */
    EdgePropertyViewSharedAcrossEdges = 'EdgePropertyViewSharedAcrossEdges'
}
