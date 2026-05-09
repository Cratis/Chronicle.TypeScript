// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection, IEnumerableString } from '@cratis/chronicle.contracts';
import { ChronicleOptions } from './ChronicleOptions';
import { EventStore } from './EventStore';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { Grpc } from './Grpc';
import { IChronicleClient } from './IChronicleClient';
import { IEventStore } from './IEventStore';

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

        const key = `${storeName.value}/${namespaceName.value}`;
        const existing = this._stores.get(key);
        if (existing) {
            return existing;
        }

        await Grpc.call<object>(callback =>
            this._connection.eventStores.ensure(
                { Name: storeName.value },
                callback
            )
        );

        const store = new EventStore(storeName, namespaceName, this._connection);
        await store.registerArtifacts();
        this._stores.set(key, store);
        return store;
    }

    /** @inheritdoc */
    async getEventStores(): Promise<EventStoreName[]> {
        const response = await Grpc.call<IEnumerableString>(callback =>
            this._connection.eventStores.getEventStores(
                {},
                callback
            )
        );
        return (response.items ?? []).map((name: string) => new EventStoreName(name));
    }

    /** @inheritdoc */
    dispose(): void {
        this._connection.disconnect();
    }
}
