// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { EventType, EventTypeGeneration, EventTypeId, IEventTypes, getEventTypeFor } from '../events';
import { EventStoreSubscriptionDefinition } from './EventStoreSubscriptionDefinition';
import { EventStoreSubscriptionId } from './EventStoreSubscriptionId';
import { IEventStoreSubscriptionBuilder } from './IEventStoreSubscriptionBuilder';

/**
 * Represents an implementation of {@link IEventStoreSubscriptionBuilder}.
 */
export class EventStoreSubscriptionBuilder implements IEventStoreSubscriptionBuilder {
    private readonly _eventTypes = new Map<string, EventType>();

    constructor(
        private readonly _eventTypesManager: IEventTypes,
        private readonly _subscriptionId: EventStoreSubscriptionId,
        private readonly _sourceEventStore: string
    ) {}

    /** @inheritdoc */
    withEventType(eventType: EventTypeId | Constructor): IEventStoreSubscriptionBuilder {
        const resolvedEventType = eventType instanceof EventTypeId
            ? this._eventTypesManager.hasFor(eventType)
                ? getEventTypeFor(this._eventTypesManager.getTypeFor(eventType))
                : new EventType(eventType, EventTypeGeneration.first, false)
            : getEventTypeFor(eventType);

        if (resolvedEventType.id.value === EventTypeId.unknown.value) {
            throw new Error('Event type must be decorated with the @eventType() decorator from @cratis/chronicle or provided as a valid EventTypeId.');
        }

        this._eventTypes.set(resolvedEventType.id.value, resolvedEventType);
        return this;
    }

    /** @inheritdoc */
    build(): EventStoreSubscriptionDefinition {
        const eventTypes = this._eventTypes.size > 0
            ? [...this._eventTypes.values()]
            : this._eventTypesManager.all
                .map(type => getEventTypeFor(type))
                .filter(type => type.id.value !== EventTypeId.unknown.value);

        return new EventStoreSubscriptionDefinition(
            this._subscriptionId,
            this._sourceEventStore,
            eventTypes
        );
    }
}
