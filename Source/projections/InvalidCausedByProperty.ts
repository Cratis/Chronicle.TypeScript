// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Error thrown when a projection refers to a member of the causing identity that the kernel does not resolve. */
export class InvalidCausedByProperty extends Error {
    /**
     * Creates an error for an unsupported causing-identity member.
     * @param property - The member supplied by the projection.
     */
    constructor(readonly property: string) {
        super(`Invalid caused by property '${property}'. Use 'subject', 'name' or 'userName'.`);
        this.name = 'InvalidCausedByProperty';
    }
}
