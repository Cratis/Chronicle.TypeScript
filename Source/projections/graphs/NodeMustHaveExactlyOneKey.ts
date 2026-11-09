// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a node type does not have exactly one member marked with the graphKey decorator.
 */
export class NodeMustHaveExactlyOneKey extends Error {
    /**
     * Creates a new {@link NodeMustHaveExactlyOneKey}.
     * @param type - The node type.
     * @param keys - The number of members with the graphKey decorator.
     */
    constructor(type: Function, keys: number) {
        super(`The node type '${type.name}' must have exactly one member with the graphKey decorator, but it has ${keys}.`);
        this.name = 'NodeMustHaveExactlyOneKey';
    }
}
