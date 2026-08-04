// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventLog } from './eventSequences/IEventLog';
import { IEventSequence } from './eventSequences/IEventSequence';
import { EventSequenceId } from './eventSequences/EventSequenceId';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { IEventTypes } from './events/IEventTypes';
import { IConstraints } from './events/constraints/IConstraints';
import { IProjections } from './projections/IProjections';
import { IReactors } from './reactors/IReactors';
import { IReducers } from './reducers/IReducers';
import { IUnitOfWorkManager } from './transactions/IUnitOfWorkManager';
import { IJobs } from './jobs/IJobs';
import { IWebhooks } from './webhooks/IWebhooks';
import { IEventSeeding } from './seeding/IEventSeeding';
import { IEventStoreSubscriptions } from './eventStoreSubscriptions/IEventStoreSubscriptions';
import { IReadModels } from './readModels/IReadModels';
import { IExternalServices } from './externalServices/IExternalServices';

/**
 * Defines the API surface for an event store.
 * An event store is a logical grouping of event sequences within a namespace.
 */
export interface IEventStore {
    /** The name of the event store. */
    readonly name: EventStoreName;

    /** The namespace of the event store. */
    readonly namespace: EventStoreNamespaceName;

    /** The primary event log sequence for this event store. */
    readonly eventLog: IEventLog;

    /** The event types manager for this event store. */
    readonly eventTypes: IEventTypes;

    /** The constraints manager for this event store. */
    readonly constraints: IConstraints;

    /** The projections manager for this event store. */
    readonly projections: IProjections;

    /** The reactors manager for this event store. */
    readonly reactors: IReactors;

    /** The reducers manager for this event store. */
    readonly reducers: IReducers;

    /** The read-models manager for this event store. */
    readonly readModels: IReadModels;

    /** The unit of work manager for transaction-scoped appends. */
    readonly unitOfWorkManager: IUnitOfWorkManager;

    /** The jobs manager for this event store. */
    readonly jobs: IJobs;

    /** The webhooks manager for this event store. */
    readonly webhooks: IWebhooks;

    /** The event store subscriptions manager for this event store. */
    readonly subscriptions: IEventStoreSubscriptions;

    /** The event seeding manager for this event store. */
    readonly seeding: IEventSeeding;

    /** The external services manager for this event store. */
    readonly externalServices: IExternalServices;

    /**
     * Gets an event sequence by its identifier.
     * @param id - The identifier of the event sequence to retrieve.
     * @returns The event sequence with the given identifier.
     */
    getEventSequence(id: EventSequenceId): IEventSequence;

    /**
     * Lists the namespaces available in this event store.
     * @returns An array of namespace names.
     */
    getNamespaces(): Promise<EventStoreNamespaceName[]>;
}
