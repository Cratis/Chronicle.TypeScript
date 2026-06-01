// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { ChronicleConnection } from '../connection';
import { EventStoreName } from '../EventStoreName';
import { IEventTypes } from '../events';
import { EventStoreSubscriptionBuilder } from './EventStoreSubscriptionBuilder';
import { EventStoreSubscriptionId } from './EventStoreSubscriptionId';
import { IEventStoreSubscriptionBuilder } from './IEventStoreSubscriptionBuilder';
import { IEventStoreSubscriptions } from './IEventStoreSubscriptions';

/**
 * Represents an implementation of {@link IEventStoreSubscriptions}.
 */
export class EventStoreSubscriptions implements IEventStoreSubscriptions {
    private readonly _logger = diag.createComponentLogger({
        namespace: '@cratis/chronicle/EventStoreSubscriptions'
    });

    constructor(
        private readonly _eventTypes: IEventTypes,
        private readonly _targetEventStore: string,
        private readonly _connection: ChronicleConnection
    ) {}

    /** @inheritdoc */
    async subscribe(
        subscriptionId: EventStoreSubscriptionId | string,
        sourceEventStore: EventStoreName | string,
        configure?: (builder: IEventStoreSubscriptionBuilder) => void
    ): Promise<void> {
        const id = typeof subscriptionId === 'string' ? new EventStoreSubscriptionId(subscriptionId) : subscriptionId;
        const source = typeof sourceEventStore === 'string' ? sourceEventStore : sourceEventStore.value;
        const builder = new EventStoreSubscriptionBuilder(this._eventTypes, id, source);
        configure?.(builder);
        const definition = builder.build();

        this._logger.info('Registering event store subscription', {
            targetEventStore: this._targetEventStore,
            subscriptionId: id.value,
            sourceEventStore: source,
            eventTypeCount: definition.eventTypes.length
        });

        await this._connection.eventStoreSubscriptions.add({
            TargetEventStore: this._targetEventStore,
            Subscriptions: [{
                Identifier: definition.id.value,
                SourceEventStore: definition.sourceEventStore,
                EventTypes: definition.eventTypes.map(_ => ({
                    Id: _.value,
                    Generation: 1,
                    Tombstone: false
                }))
            }]
        });
    }

    /** @inheritdoc */
    async unsubscribe(subscriptionId: EventStoreSubscriptionId | string): Promise<void> {
        const id = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.value;

        this._logger.info('Removing event store subscription', {
            targetEventStore: this._targetEventStore,
            subscriptionId: id
        });

        await this._connection.eventStoreSubscriptions.remove({
            TargetEventStore: this._targetEventStore,
            SubscriptionIds: [id]
        });
    }
}
