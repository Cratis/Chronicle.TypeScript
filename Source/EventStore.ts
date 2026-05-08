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

/**
 * Implements {@link IEventStore} by communicating with the Chronicle Kernel
 * via gRPC using the provided {@link ChronicleConnection}.
 */
export class EventStore implements IEventStore {
    readonly eventLog: IEventLog;
    private readonly _sequences: Map<string, IEventSequence> = new Map();

    constructor(
        readonly name: EventStoreName,
        readonly namespace: EventStoreNamespaceName,
        private readonly _connection: ChronicleConnection
    ) {
        this.eventLog = new EventLog(name.value, namespace.value, _connection);
        this._sequences.set(EventSequenceId.eventLog.value, this.eventLog);
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
