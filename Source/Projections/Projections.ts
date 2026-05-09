// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { ChronicleConnection } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts';
import { IProjections } from './IProjections';
import { getProjectionMetadata } from './declarative/projection';
import { getModelBoundMetadata } from './modelBound/modelBound';

/**
 * Implements {@link IProjections}, managing discovery and registration of projections
 * with the Chronicle Kernel.
 */
export class Projections implements IProjections {
    private readonly _declarative = new Map<string, Constructor>();
    private readonly _modelBound = new Map<string, Constructor>();

    // Reserved for gRPC registration once projection definition serialization is implemented.
    private readonly _eventStore: string;
    private readonly _connection: ChronicleConnection;

    /**
     * Creates a new {@link Projections} instance.
     * @param eventStore - The name of the event store these projections belong to.
     * @param connection - The connection used to communicate with the Kernel.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(
        eventStore: string,
        connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {
        this._eventStore = eventStore;
        this._connection = connection;
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._declarative.clear();
        this._modelBound.clear();

        for (const type of this._clientArtifacts.projections) {
            const metadata = getProjectionMetadata(type);
            if (metadata) {
                this._declarative.set(metadata.id.value, type);
            }
        }

        for (const type of this._clientArtifacts.modelBoundProjections) {
            const metadata = getModelBoundMetadata(type);
            if (metadata) {
                this._modelBound.set(metadata.id.value, type);
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._declarative.size === 0 && this._modelBound.size === 0) {
            await this.discover();
        }

        // Full projection definition serialization and gRPC registration will be
        // implemented as the projection engine support matures.
        void this._eventStore;
        void this._connection;
    }
}
