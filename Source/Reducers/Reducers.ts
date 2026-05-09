// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts';
import { IReducers } from './IReducers';
import { getReducerMetadata } from './reducer';

/**
 * Implements {@link IReducers}, managing discovery and registration of reducers
 * with the Chronicle Kernel.
 */
export class Reducers implements IReducers {
    private readonly _reducers = new Map<string, Constructor>();

    /**
     * Creates a new {@link Reducers} instance.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(private readonly _clientArtifacts: IClientArtifactsProvider) {}

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
        // Full streaming observation will be added once the observation
        // infrastructure is implemented in the TypeScript client.
    }
}
