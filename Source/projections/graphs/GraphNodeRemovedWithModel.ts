// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents how an event deletes a node.
 */
export interface GraphNodeRemovedWithModel {
    /** The event type. */
    readonly eventType: Function;

    /** The expression for the key of the node, or undefined for the event source id. */
    readonly key?: string;

    /** Whether the edges attached to the node are deleted with it. */
    readonly detach: boolean;
}
