// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when an edge type does not name its end nodes.
 */
export class EdgeMustHaveOneSourceAndOneTarget extends Error {
    /**
     * Creates a new {@link EdgeMustHaveOneSourceAndOneTarget}.
     * @param type - The edge type.
     */
    constructor(type: Function) {
        super(`The edge type '${type.name}' must have exactly one member with the edgeSource decorator and exactly one with the edgeTarget decorator.`);
        this.name = 'EdgeMustHaveOneSourceAndOneTarget';
    }
}
