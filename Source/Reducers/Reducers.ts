// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { ChronicleConnection } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts';
import { IReducers } from './IReducers';
import { getReducerMetadata } from './reducer';

/**
 * Implements {@link IReducers}, managing discovery and registration of reducers
 * with the Chronicle Kernel.
 */
export class Reducers implements IReducers {
    private readonly _reducers = new Map<string, Constructor>();

    // Reserved for streaming gRPC registration once observation infrastructure is implemented.
    private readonly _eventStore: string;
    private readonly _namespace: string;
    private readonly _connection: ChronicleConnection;

    /**
     * Creates a new {@link Reducers} instance.
     * @param eventStore - The name of the event store these reducers belong to.
     * @param namespace - The namespace within the event store.
     * @param connection - The connection used to communicate with the Kernel.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(
        eventStore: string,
        namespace: string,
        connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {
        this._eventStore = eventStore;
        this._namespace = namespace;
        this._connection = connection;
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._reducers.clear();
        for (const type of this._clientArtifacts.reducers) {
            const metadata = getReducerMetadata(type);
            if (metadata) {
                this._reducers.set(metadata.id.value, type);
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._reducers.size === 0) {
            await this.discover();
        }

        // Reducer registration uses a bidirectional streaming gRPC call.
        // Full streaming registration will be implemented as the observation
        // infrastructure matures in the TypeScript client.
        void this._eventStore;
        void this._namespace;
        void this._connection;
    }
}
