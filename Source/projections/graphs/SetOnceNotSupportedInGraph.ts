// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a member of a node or an edge asks to only be set once. Graph projections do not read the current
 * state of a node or an edge, so a set once mapping would silently overwrite the value.
 */
export class SetOnceNotSupportedInGraph extends Error {
    /**
     * Creates a new {@link SetOnceNotSupportedInGraph}.
     * @param type - The node or edge type.
     * @param property - The name of the property.
     */
    constructor(type: Function, property: string) {
        super(`The property '${property}' of '${type.name}' is mapped with setOnce. Set once is not supported on graph nodes and edges.`);
        this.name = 'SetOnceNotSupportedInGraph';
    }
}
