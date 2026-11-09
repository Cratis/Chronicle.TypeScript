// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a node or an edge has an object property.
 */
export class NestedObjectInGraph extends Error {
    /**
     * Creates a new {@link NestedObjectInGraph}.
     * @param type - The node or edge type.
     * @param property - The name of the property.
     */
    constructor(type: Function, property: string) {
        super(`The property '${property}' of '${type.name}' is an object. Nodes and edges can only have primitive properties and arrays of primitives.`);
        this.name = 'NestedObjectInGraph';
    }
}
