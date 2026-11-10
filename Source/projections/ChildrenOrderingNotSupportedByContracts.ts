// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a projection orders its children but the installed `@cratis/chronicle.contracts` package cannot carry
 * the ordering to the kernel. Registering anyway would silently append every child.
 */
export class ChildrenOrderingNotSupportedByContracts extends Error {
    /**
     * Creates the error.
     * @param projection - The projection identifier.
     * @param path - The contract path of the ordered children collection.
     */
    constructor(readonly projection: string, readonly path: string) {
        super(`Projection '${projection}' orders the children at '${path}', but the installed @cratis/chronicle.contracts package does not support children ordering. Upgrade @cratis/chronicle.contracts to a version that includes ChildrenOrderingDefinition, or remove the ordering.`);
        this.name = 'ChildrenOrderingNotSupportedByContracts';
    }
}
