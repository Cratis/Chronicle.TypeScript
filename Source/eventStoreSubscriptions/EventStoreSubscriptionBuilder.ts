// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { EventTypeId, IEventTypes, getEventTypeFor } from '../events';
import { EventStoreSubscriptionDefinition } from './EventStoreSubscriptionDefinition';
import { EventStoreSubscriptionId } from './EventStoreSubscriptionId';
import { IEventStoreSubscriptionBuilder } from './IEventStoreSubscriptionBuilder';

/**
 * Represents an implementation of {@link IEventStoreSubscriptionBuilder}.
 */
export class EventStoreSubscriptionBuilder implements IEventStoreSubscriptionBuilder {
    private readonly _eventTypes = new Map<string, EventTypeId>();

    constructor(
        private readonly _eventTypesManager: IEventTypes,
        private readonly _subscriptionId: EventStoreSubscriptionId,
        private readonly _sourceEventStore: string
    ) {}

    /** @inheritdoc */
    withEventType(eventType: EventTypeId | Constructor): IEventStoreSubscriptionBuilder {
        const eventTypeId = eventType instanceof EventTypeId
            ? eventType
            : getEventTypeFor(eventType).id;

        if (eventTypeId.value === EventTypeId.unknown.value) {
            throw new Error('Event type must be decorated with @eventType() or provided as an EventTypeId.');
        }

        this._eventTypes.set(eventTypeId.value, eventTypeId);
        return this;
    }

    /** @inheritdoc */
    build(): EventStoreSubscriptionDefinition {
        const eventTypes = this._eventTypes.size > 0
            ? [...this._eventTypes.values()]
            : this._eventTypesManager.all
                .map(type => getEventTypeFor(type).id)
                .filter(id => id.value !== EventTypeId.unknown.value);

        return new EventStoreSubscriptionDefinition(
            this._subscriptionId,
            this._sourceEventStore,
            eventTypes
        );
    }
}
