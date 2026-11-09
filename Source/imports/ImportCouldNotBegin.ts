// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The exception that is thrown when an import could not begin or be reattached. */
export class ImportCouldNotBegin extends Error {
    /**
     * Creates a new {@link ImportCouldNotBegin}.
     * @param reason - Why the import could not begin.
     */
    constructor(readonly reason: string) {
        super(`The import could not begin: ${reason}`);
        this.name = 'ImportCouldNotBegin';
    }
}
