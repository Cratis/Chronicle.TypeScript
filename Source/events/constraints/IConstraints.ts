// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConstraintId } from './ConstraintId';

/**
 * Defines a system to work with constraints, including discovery and registration with the Kernel.
 */
export interface IConstraints {
    /**
     * Discovers all constraints from the registered client artifacts.
     * @returns A promise that resolves when discovery is complete.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered constraints with the Chronicle Kernel.
     * @returns A promise that resolves when registration is complete.
     */
    register(): Promise<void>;

    /**
     * Checks whether a constraint exists for the given identifier.
     * @param id - The constraint identifier to look up.
     * @returns True if a matching constraint exists; otherwise false.
     */
    hasFor(id: ConstraintId): boolean;
}
