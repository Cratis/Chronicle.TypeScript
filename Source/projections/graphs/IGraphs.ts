// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { GraphRegistration } from './GraphRegistration.js';

/**
 * Defines a system for the property graphs an application declares, with the decorators and with the fluent builder,
 * including discovery and registration with the Chronicle Kernel.
 */
export interface IGraphs {
    /** Gets the registrations found by the last call to {@link IGraphs.discover}. */
    readonly registrations: readonly GraphRegistration[];

    /**
     * Gets the declarations that could not be turned into a registration, and why. One invalid graph does not
     * take the rest of the graphs down with it.
     */
    readonly failures: ReadonlyMap<Constructor, Error>;

    /**
     * Discovers the graphs from the registered client artifacts.
     * @returns A promise that resolves when discovery is complete.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered graphs with the Chronicle Kernel: the read model that describes each graph and the
     * projection that fills it.
     * @returns A promise that resolves when registration is complete.
     */
    register(): Promise<void>;
}
