// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { EventTypeId } from '../events';
import { EventStoreSubscriptionDefinition } from './EventStoreSubscriptionDefinition';

/**
 * Defines a builder for configuring an event store subscription.
 */
export interface IEventStoreSubscriptionBuilder {
    /**
     * Specify the event types to subscribe to. If not specified, all discovered event types are subscribed.
     * @param eventType - The event type identifier or decorated event constructor to include.
     * @returns The builder for continuation.
     */
    withEventType(eventType: EventTypeId | Constructor): IEventStoreSubscriptionBuilder;

    /**
     * Build the subscription definition.
     * @returns The event store subscription definition.
     */
    build(): EventStoreSubscriptionDefinition;
}
