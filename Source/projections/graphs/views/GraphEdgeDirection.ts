// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the direction in which a relation follows an edge, seen from the root node of the view.
 */
export enum GraphEdgeDirection {
    /** The root node is the source of the edge. */
    Outgoing = 'outgoing',

    /** The root node is the target of the edge. */
    Incoming = 'incoming'
}
