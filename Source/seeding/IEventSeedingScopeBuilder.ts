// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines a scoped builder for namespace-specific event seeding.
 */
export interface IEventSeedingScopeBuilder {
    /**
     * Seeds events for a specific event source id.
     * @param eventSourceId - The event source id to seed for.
     * @param events - The events to seed.
     * @returns The scoped builder for chaining.
     */
    for<TEvent extends object>(eventSourceId: string, events: Iterable<TEvent>): IEventSeedingScopeBuilder;

    /**
     * Seeds events of multiple types for a specific event source id.
     * @param eventSourceId - The event source id to seed for.
     * @param events - The events to seed.
     * @returns The scoped builder for chaining.
     */
    forEventSource(eventSourceId: string, events: Iterable<object>): IEventSeedingScopeBuilder;
}
