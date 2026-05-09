// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection, IEnumerableString } from '@cratis/chronicle.contracts';
import { SpanStatusCode } from '@opentelemetry/api';
import { ChronicleOptions } from './ChronicleOptions';
import { EventStore } from './EventStore';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { Grpc } from './Grpc';
import { IChronicleClient } from './IChronicleClient';
import { IEventStore } from './IEventStore';
import { ChronicleTracer } from './Tracing';

/**
 * Implements {@link IChronicleClient} by managing a gRPC connection to the
 * Chronicle Kernel via {@link ChronicleConnection}.
 *
 * Create a client by providing {@link ChronicleOptions} configured with a connection string:
 *
 * ```typescript
 * const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000'));
 * const store = await client.getEventStore('MyStore');
 * await store.eventLog.append('my-entity-id', new MyEvent('data'));
 * client.dispose();
 * ```
 */
export class ChronicleClient implements IChronicleClient {
    private readonly _connection: ChronicleConnection;
    private readonly _stores: Map<string, IEventStore> = new Map();

    /**
     * Creates a new {@link ChronicleClient} using the provided options.
     * @param options - The options to configure the client, including the connection string.
     */
    constructor(readonly options: ChronicleOptions) {
        this._connection = new ChronicleConnection({
            connectionString: options.connectionString
        });
    }

    /** @inheritdoc */
    async getEventStore(name: string | EventStoreName, namespace?: string | EventStoreNamespaceName): Promise<IEventStore> {
        const storeName = typeof name === 'string' ? new EventStoreName(name) : name;
        const namespaceName = namespace === undefined
            ? EventStoreNamespaceName.default
            : typeof namespace === 'string'
                ? new EventStoreNamespaceName(namespace)
                : namespace;

        return ChronicleTracer.startActiveSpan('chronicle.client.get_event_store', async span => {
            span.setAttribute('chronicle.event_store', storeName.value);
            span.setAttribute('chronicle.namespace', namespaceName.value);
            try {
                const key = `${storeName.value}/${namespaceName.value}`;
                const existing = this._stores.get(key);
                if (existing) {
                    span.setStatus({ code: SpanStatusCode.OK });
                    return existing;
                }

                await Grpc.call<object>(callback =>
                    this._connection.eventStores.ensure(
                        { Name: storeName.value },
                        callback
                    )
                );

                const store = new EventStore(storeName, namespaceName, this._connection);
                this._stores.set(key, store);
                span.setStatus({ code: SpanStatusCode.OK });
                return store;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async getEventStores(): Promise<EventStoreName[]> {
        return ChronicleTracer.startActiveSpan('chronicle.client.get_event_stores', async span => {
            try {
                const response = await Grpc.call<IEnumerableString>(callback =>
                    this._connection.eventStores.getEventStores(
                        {},
                        callback
                    )
                );
                const result = (response.items ?? []).map((name: string) => new EventStoreName(name));
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

    /** @inheritdoc */
    dispose(): void {
        this._connection.disconnect();
    }
}
