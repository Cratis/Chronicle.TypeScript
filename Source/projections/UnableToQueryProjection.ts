// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a projection query fails because the Projection Declaration Language
 * declaration contains errors.
 */
export class UnableToQueryProjection extends Error {
    /**
     * Creates a new {@link UnableToQueryProjection}.
     * @param errors - The collection of error messages describing why the query failed.
     */
    constructor(errors: ReadonlyArray<string>) {
        super(`Unable to query projection. Errors:\n${errors.join('\n')}`);
        this.name = 'UnableToQueryProjection';
    }
}
