// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a graph mapping needs an event property that the event type does not have.
 */
export class UnknownGraphEventProperty extends Error {
    /**
     * Creates a new {@link UnknownGraphEventProperty}.
     * @param type - The node or edge type.
     * @param eventType - The event type.
     * @param property - The name of the property.
     */
    constructor(type: Function, eventType: Function, property: string) {
        super(`The mapping of '${type.name}' refers to the property '${property}', which '${eventType.name}' does not have.`);
        this.name = 'UnknownGraphEventProperty';
    }
}
