// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { EventSourceDefinition } from './EventSourceDefinition.js';

/**
 * Defines the discovery and registration of event source definitions.
 */
export interface IEventSources {
    /** Gets all discovered event source definitions. */
    readonly all: ReadonlyArray<EventSourceDefinition>;

    /**
     * Discovers the event source definitions from the client artifacts.
     * @throws DuplicateEventSourceName when two definitions share a name.
     * @throws DuplicateEventStreamName when a definition declares the same stream twice.
     */
    discover(): Promise<void>;

    /**
     * Registers the discovered definitions with the Kernel. Registration is an upsert; the Kernel retains
     * historical definitions that are no longer registered. Does nothing when there are no definitions.
     */
    register(): Promise<void>;

    /**
     * Gets the definition by class or name.
     * @param eventSource - The class decorated with `@eventSource`, or the definition name.
     * @throws UnknownEventSource when there is no such definition.
     */
    getFor(eventSource: Constructor | string): EventSourceDefinition;
}
