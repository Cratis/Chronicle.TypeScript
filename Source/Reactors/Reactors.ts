// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { ChronicleConnection } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts';
import { IReactors } from './IReactors';
import { getReactorMetadata } from './reactor';

/**
 * Implements {@link IReactors}, managing discovery and registration of reactors
 * with the Chronicle Kernel.
 */
export class Reactors implements IReactors {
    private readonly _reactors = new Map<string, Constructor>();

    // Reserved for streaming gRPC registration once observation infrastructure is implemented.
    private readonly _eventStore: string;
    private readonly _namespace: string;
    private readonly _connection: ChronicleConnection;

    /**
     * Creates a new {@link Reactors} instance.
     * @param eventStore - The name of the event store these reactors belong to.
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
        this._reactors.clear();
        for (const type of this._clientArtifacts.reactors) {
            const metadata = getReactorMetadata(type);
            if (metadata) {
                this._reactors.set(metadata.id.value, type);
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._reactors.size === 0) {
            await this.discover();
        }

        // Reactor registration uses a bidirectional streaming gRPC call.
        // Full streaming registration will be implemented as the observation
        // infrastructure matures in the TypeScript client.
        void this._eventStore;
        void this._namespace;
        void this._connection;
    }
}
