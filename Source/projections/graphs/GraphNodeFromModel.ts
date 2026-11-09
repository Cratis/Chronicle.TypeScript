// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents how an event creates or updates a node.
 */
export interface GraphNodeFromModel {
    /** The event type. */
    readonly eventType: Function;

    /** The expression for the key of the node, or undefined for the event source id. */
    readonly key?: string;

    /** The property mapping expressions by node property name. */
    readonly properties: Readonly<Record<string, string>>;

    /** Whether the event only changes a node that already exists. */
    readonly updateOnly: boolean;
}
