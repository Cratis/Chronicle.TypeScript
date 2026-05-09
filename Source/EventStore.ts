// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection, IEnumerableString } from '@cratis/chronicle.contracts';
import { SpanStatusCode } from '@opentelemetry/api';
import { EventLog } from './EventSequences/EventLog';
import { EventSequence } from './EventSequences/EventSequence';
import { EventSequenceId } from './EventSequences/EventSequenceId';
import { IEventLog } from './EventSequences/IEventLog';
import { IEventSequence } from './EventSequences/IEventSequence';
import { Grpc } from './Grpc';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { IEventStore } from './IEventStore';
import { ChronicleTracer } from './Tracing';

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
        return ChronicleTracer.startActiveSpan('chronicle.event_store.get_namespaces', async span => {
            span.setAttribute('chronicle.event_store', this.name.value);
            try {
                const response = await Grpc.call<IEnumerableString>(callback =>
                    this._connection.namespaces.getNamespaces(
                        { EventStore: this.name.value },
                        callback
                    )
                );
                const result = (response.items ?? []).map((namespace: string) => new EventStoreNamespaceName(namespace));
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }
}
