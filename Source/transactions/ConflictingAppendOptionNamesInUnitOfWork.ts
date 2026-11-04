// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when an append option alias and its transactional name have different values.
 */
export class ConflictingAppendOptionNamesInUnitOfWork extends Error {
    /**
     * Initializes a new instance of the {@link ConflictingAppendOptionNamesInUnitOfWork} class.
     * @param appendOptionName - The ordinary append option name.
     * @param transactionalOptionName - The transactional append option name.
     */
    constructor(readonly appendOptionName: string, readonly transactionalOptionName: string) {
        super(`The append options give both '${appendOptionName}' and '${transactionalOptionName}' with different values. Give only one of them.`);
        this.name = 'ConflictingAppendOptionNamesInUnitOfWork';
    }
}
