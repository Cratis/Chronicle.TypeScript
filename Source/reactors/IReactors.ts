// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines a system to work with reactors, including discovery and registration with the Kernel.
 */
export interface IReactors {
    /**
     * Discovers all reactors from the registered client artifacts.
     * @returns A promise that resolves when discovery is complete.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered reactors with the Chronicle Kernel and starts observation.
     * @returns A promise that resolves when registration is complete.
     */
    register(): Promise<void>;
}
