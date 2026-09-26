// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventLog } from './eventSequences/IEventLog.js';
import { IEventSequence } from './eventSequences/IEventSequence.js';
import { EventSequenceId } from './eventSequences/EventSequenceId.js';
import { EventStoreName } from './EventStoreName.js';
import { EventStoreNamespaceName } from './EventStoreNamespaceName.js';
import { IEventTypes } from './events/IEventTypes.js';
import { IConstraints } from './events/constraints/IConstraints.js';
import { IProjections } from './projections/IProjections.js';
import { IReactors } from './reactors/IReactors.js';
import { IReducers } from './reducers/IReducers.js';
import { IUnitOfWorkManager } from './transactions/IUnitOfWorkManager.js';
import { IJobs } from './jobs/IJobs.js';
import { IWebhooks } from './webhooks/IWebhooks.js';
import { IEventSeeding } from './seeding/IEventSeeding.js';
import { IEventStoreSubscriptions } from './eventStoreSubscriptions/IEventStoreSubscriptions.js';
import { IReadModels } from './readModels/IReadModels.js';
import { IExternalServices } from './externalServices/IExternalServices.js';
import { IIdentityManager } from './identities/IIdentityManager.js';
import { IPIIManager } from './compliance/IPIIManager.js';
import { IFailedPartitions } from './observation/IFailedPartitions.js';
import { IObservers } from './observation/IObservers.js';

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

    /** The identities manager for this event store. */
    readonly identities: IIdentityManager;

    /** The PII (Personal Identifiable Information) compliance manager for this event store. */
    readonly pii: IPIIManager;

    /** The failed partitions manager for this event store. */
    readonly failedPartitions: IFailedPartitions;

    /**
     * The observers registered in the event store, for operating on them - listing what is registered, and
     * removing one whose declaring code is gone.
     */
    readonly observers: IObservers;

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
