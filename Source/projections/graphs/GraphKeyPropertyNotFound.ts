// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when the key of a node or the identity of an edge is not a property of its type.
 */
export class GraphKeyPropertyNotFound extends Error {
    /**
     * Creates a new {@link GraphKeyPropertyNotFound}.
     * @param type - The node or edge type.
     * @param property - The name of the key property.
     */
    constructor(type: Function, property: string) {
        super(`The key '${property}' of '${type.name}' is not a property of the type. Declare it with an initializer or with the field decorator so its type can be resolved.`);
        this.name = 'GraphKeyPropertyNotFound';
    }
}
