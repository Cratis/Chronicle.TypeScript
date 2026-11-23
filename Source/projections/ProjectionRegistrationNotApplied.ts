// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Error thrown when the kernel accepted a projection registration but could not apply it. */
export class ProjectionRegistrationNotApplied extends Error {
    /**
     * Creates the error.
     * @param registrant - The registrant the registration was made as.
     * @param failure - Why the kernel could not apply the registration.
     */
    constructor(readonly registrant: string, readonly failure: string) {
        super(`The kernel accepted the projection registration of '${registrant}' but could not apply it: ${failure}`);
        this.name = 'ProjectionRegistrationNotApplied';
    }
}
