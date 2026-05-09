// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventLog } from './EventSequences/IEventLog';
import { IEventSequence } from './EventSequences/IEventSequence';
import { EventSequenceId } from './EventSequences/EventSequenceId';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { IEventTypes } from './Events/IEventTypes';
import { IConstraints } from './Events/Constraints/IConstraints';
import { IProjections } from './Projections/IProjections';
import { IReactors } from './Reactors/IReactors';
import { IReducers } from './Reducers/IReducers';

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
