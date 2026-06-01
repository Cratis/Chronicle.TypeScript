// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventType } from '../events';
import { EventStoreSubscriptionId } from './EventStoreSubscriptionId';

/**
 * Represents a definition of an event store subscription.
 */
export class EventStoreSubscriptionDefinition {
    constructor(
        readonly id: EventStoreSubscriptionId,
        readonly sourceEventStore: string,
        readonly eventTypes: EventType[]
    ) {}
}
