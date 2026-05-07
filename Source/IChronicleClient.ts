// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleOptions } from './ChronicleOptions';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { IEventStore } from './IEventStore';

/**
 * Defines the Cratis Chronicle client API surface.
 *
 * The Chronicle client is the primary entry point for interacting with the
 * Chronicle Kernel. Use it to obtain event stores, which in turn provide access
 * to event sequences for appending and observing events.
 */
export interface IChronicleClient {
    /** The options used to configure the client. */
    readonly options: ChronicleOptions;

    /**
     * Gets or creates an event store by name and optional namespace.
     * If no namespace is provided, the default namespace is used.
     * @param name - The name of the event store.
     * @param namespace - Optional namespace name within the event store.
     * @returns The event store.
     */
    getEventStore(name: string | EventStoreName, namespace?: string | EventStoreNamespaceName): Promise<IEventStore>;

    /**
     * Lists all event stores registered with the Chronicle Kernel.
     * @returns An array of event store names.
     */
    getEventStores(): Promise<EventStoreName[]>;

    /**
     * Disposes of the client and releases all underlying resources.
     */
    dispose(): void;
}
