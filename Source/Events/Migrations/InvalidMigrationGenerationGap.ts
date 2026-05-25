// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Exception thrown when a migration does not connect adjacent generations.
 */
export class InvalidMigrationGenerationGap extends Error {
    constructor(
        previousTypeName: string,
        upgradeTypeName: string,
        previousGeneration: number,
        upgradeGeneration: number
    ) {
        super(
            `Migration from '${previousTypeName}' (generation ${previousGeneration}) to '${upgradeTypeName}' ` +
            `(generation ${upgradeGeneration}) is invalid. The upgrade generation must be exactly one more than the previous generation.`
        );
    }
}
