// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventStoreNamespaceName } from '../EventStoreNamespaceName';
import { IEventSeedingScopeBuilder } from './IEventSeedingScopeBuilder';

/**
 * Defines a builder for seeding events in the event store.
 */
export interface IEventSeedingBuilder {
    /**
     * Seeds events for a specific event source id.
     * By default, seed data applies to all namespaces globally.
     * @param eventSourceId - The event source id to seed for.
     * @param events - The events to seed.
     * @returns The builder for chaining.
     */
    for<TEvent extends object>(eventSourceId: string, events: Iterable<TEvent>): IEventSeedingBuilder;

    /**
     * Seeds events of multiple types for a specific event source id.
     * By default, seed data applies to all namespaces globally.
     * @param eventSourceId - The event source id to seed for.
     * @param events - The events to seed.
     * @returns The builder for chaining.
     */
    forEventSource(eventSourceId: string, events: Iterable<object>): IEventSeedingBuilder;

    /**
     * Configures seed data to be specific to a namespace.
     * @param namespace - The namespace to seed for.
     * @returns A scoped builder for namespace-specific seed data.
     */
    forNamespace(namespace: string | EventStoreNamespaceName): IEventSeedingScopeBuilder;
}
