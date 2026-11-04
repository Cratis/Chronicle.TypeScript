// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when an append option cannot be honored in a unit of work.
 */
export class AppendOptionNotSupportedInUnitOfWork extends Error {
    /**
     * Initializes a new instance of the {@link AppendOptionNotSupportedInUnitOfWork} class.
     * @param optionName - The unsupported append option name.
     * @param guidance - How to supply the intended metadata instead.
     */
    constructor(readonly optionName: string, guidance: string) {
        super(`A unit of work cannot honour the append option '${optionName}'. ${guidance}`);
        this.name = 'AppendOptionNotSupportedInUnitOfWork';
    }
}
