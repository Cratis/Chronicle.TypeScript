// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Represents an edge of the graph the views were validated against. */
export interface GraphViewSchemaEdge {
    /** The edge type, for example MEMBER_OF. */
    readonly type: string;

    /** The label of the node the edge starts at. */
    readonly source: string;

    /** The label of the node the edge ends at. */
    readonly target: string;

    /** The name of the property that identifies the edge, for an identified edge. */
    readonly identifiedBy?: string;

    /** The names of the properties of the edge. */
    readonly properties: readonly string[];
}
