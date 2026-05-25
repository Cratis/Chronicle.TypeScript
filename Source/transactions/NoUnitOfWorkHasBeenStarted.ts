// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when there is no current unit of work for the active async context.
 */
export class NoUnitOfWorkHasBeenStarted extends Error {
    /**
     * Initializes a new instance of the {@link NoUnitOfWorkHasBeenStarted} class.
     */
    constructor() {
        super('No unit of work has been started for the current async context.');
    }
}
