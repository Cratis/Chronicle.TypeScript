// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines a system to work with projections, including discovery and registration with the Kernel.
 */
export interface IProjections {
    /**
     * Discovers all projections from the registered client artifacts.
     * @returns A promise that resolves when discovery is complete.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered projections with the Chronicle Kernel.
     * @returns A promise that resolves when registration is complete.
     */
    register(): Promise<void>;
}
