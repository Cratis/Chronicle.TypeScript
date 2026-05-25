// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { EventTypeId } from './EventTypeId';

/**
 * Defines a system to work with event types, including discovery and registration with the Kernel.
 */
export interface IEventTypes {
    /** Gets all registered event type constructors. */
    readonly all: Constructor[];

    /**
     * Discovers all event types from the registered client artifacts.
     * @returns A promise that resolves when discovery is complete.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered event types with the Chronicle Kernel.
     * @returns A promise that resolves when registration is complete.
     */
    register(): Promise<void>;

    /**
     * Checks whether an event type constructor exists for the given identifier.
     * @param id - The event type identifier to look up.
     * @returns True if a matching type exists; otherwise false.
     */
    hasFor(id: EventTypeId): boolean;

    /**
     * Gets the event type constructor for the given identifier.
     * @param id - The event type identifier to look up.
     * @returns The constructor for the event type.
     */
    getTypeFor(id: EventTypeId): Constructor;
}
