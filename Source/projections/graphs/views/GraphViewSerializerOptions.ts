// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Options of the {@link GraphViewDefinitionSerializer}. */
export interface GraphViewSerializerOptions {
    /**
     * Whether to also write the schema, the nodes and edges the views were validated against, between the graph and
     * the views. It is the form of the shared conformance fixture. Defaults to false.
     */
    readonly includeSchema?: boolean;
}
