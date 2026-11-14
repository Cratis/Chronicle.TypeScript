// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Represents a node of the graph the views were validated against. */
export interface GraphViewSchemaNode {
    /** The node label. */
    readonly label: string;

    /** The name of the property that holds the key of the node. */
    readonly key: string;

    /** The names of the properties of the node. */
    readonly properties: readonly string[];
}
