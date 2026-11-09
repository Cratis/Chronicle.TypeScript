// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents how an event deletes an edge.
 */
export interface GraphEdgeRemovedWithModel {
    /** The event type. */
    readonly eventType: Function;

    /** The expression for the key of the source node, or undefined for the event source id. */
    readonly sourceKey?: string;

    /** The expression for the key of the target node, or undefined for the event source id. */
    readonly targetKey?: string;

    /** The expression for the identity of the edge, for an edge type with an identifying property. */
    readonly identity?: string;
}
