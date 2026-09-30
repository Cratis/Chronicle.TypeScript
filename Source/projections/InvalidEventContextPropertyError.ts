// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Error thrown when a projection maps a path that is not supported by the event-context resolver. */
export class InvalidEventContextPropertyError extends Error {
    /**
     * Creates an error for an unsupported event-context property path.
     * @param propertyPath - The path supplied by the projection mapping.
     */
    constructor(readonly propertyPath: string) {
        super(`Invalid event context property '${propertyPath}'.`);
        this.name = 'InvalidEventContextPropertyError';
    }
}
