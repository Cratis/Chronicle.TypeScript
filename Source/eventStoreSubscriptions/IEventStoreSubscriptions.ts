// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventStoreName } from '../EventStoreName';
import { EventStoreSubscriptionDefinition } from './EventStoreSubscriptionDefinition';
import { EventStoreSubscriptionId } from './EventStoreSubscriptionId';
import { IEventStoreSubscriptionBuilder } from './IEventStoreSubscriptionBuilder';

/**
 * Defines the API for managing event store subscriptions.
 */
export interface IEventStoreSubscriptions {
    /**
     * Subscribe to events from a source event store.
     * @param subscriptionId - The unique identifier for the subscription.
     * @param sourceEventStore - The source event store to subscribe to.
     * @param configure - Optional callback to configure the subscription.
     */
    subscribe(
        subscriptionId: EventStoreSubscriptionId | string,
        sourceEventStore: EventStoreName | string,
        configure?: (builder: IEventStoreSubscriptionBuilder) => void
    ): Promise<void>;

    /**
     * Removes a subscription by its identifier.
     * @param subscriptionId - The subscription identifier to remove.
     */
    unsubscribe(subscriptionId: EventStoreSubscriptionId | string): Promise<void>;

    /**
     * Gets all subscriptions registered for this event store.
     * @returns A collection of {@link EventStoreSubscriptionDefinition}.
     */
    getAll(): Promise<EventStoreSubscriptionDefinition[]>;
}
