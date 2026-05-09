// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection, IEnumerableString } from '@cratis/chronicle.contracts';
import { EventLog } from './EventSequences/EventLog';
import { EventSequence } from './EventSequences/EventSequence';
import { EventSequenceId } from './EventSequences/EventSequenceId';
import { IEventLog } from './EventSequences/IEventLog';
import { IEventSequence } from './EventSequences/IEventSequence';
import { Grpc } from './Grpc';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { IEventStore } from './IEventStore';
import { EventTypes } from './Events/EventTypes';
import { IEventTypes } from './Events/IEventTypes';
import { Constraints } from './Events/Constraints/Constraints';
import { IConstraints } from './Events/Constraints/IConstraints';
import { Projections } from './Projections/Projections';
import { IProjections } from './Projections/IProjections';
import { Reactors } from './Reactors/Reactors';
import { IReactors } from './Reactors/IReactors';
import { Reducers } from './Reducers/Reducers';
import { IReducers } from './Reducers/IReducers';
import { DefaultClientArtifactsProvider } from './artifacts/DefaultClientArtifactsProvider';

/**
 * Implements {@link IEventStore} by communicating with the Chronicle Kernel
 * via gRPC using the provided {@link ChronicleConnection}.
 */
export class EventStore implements IEventStore {
    readonly eventLog: IEventLog;
    readonly eventTypes: IEventTypes;
    readonly constraints: IConstraints;
    readonly projections: IProjections;
    readonly reactors: IReactors;
    readonly reducers: IReducers;

    private readonly _sequences: Map<string, IEventSequence> = new Map();

    constructor(
        readonly name: EventStoreName,
        readonly namespace: EventStoreNamespaceName,
        private readonly _connection: ChronicleConnection
    ) {
        this.eventLog = new EventLog(name.value, namespace.value, _connection);
        this._sequences.set(EventSequenceId.eventLog.value, this.eventLog);

        const artifacts = DefaultClientArtifactsProvider.default;
        this.eventTypes = new EventTypes(name.value, _connection, artifacts);
        this.constraints = new Constraints(name.value, _connection, artifacts);
        this.projections = new Projections(name.value, _connection, artifacts);
        this.reactors = new Reactors(name.value, namespace.value, _connection, artifacts);
        this.reducers = new Reducers(name.value, namespace.value, _connection, artifacts);
    }

    /**
     * Registers all discovered artifacts with the Chronicle Kernel.
     * Called on initial connect and on reconnect.
     * @returns A promise that resolves when all registrations are complete.
     */
    async registerArtifacts(): Promise<void> {
        await Promise.all([
            this.eventTypes.register(),
            this.constraints.register(),
            this.projections.register(),
            this.reactors.register(),
            this.reducers.register()
        ]);
    }

    /** @inheritdoc */
    getEventSequence(id: EventSequenceId): IEventSequence {
        const existing = this._sequences.get(id.value);
        if (existing) {
            return existing;
        }

        const sequence = new EventSequence(id, this.name.value, this.namespace.value, this._connection);
        this._sequences.set(id.value, sequence);
        return sequence;
    }

    /** @inheritdoc */
    async getNamespaces(): Promise<EventStoreNamespaceName[]> {
        const response = await Grpc.call<IEnumerableString>(callback =>
            this._connection.namespaces.getNamespaces(
                { EventStore: this.name.value },
                callback
            )
        );

        return (response.items ?? []).map((namespace: string) => new EventStoreNamespaceName(namespace));
    }
}
