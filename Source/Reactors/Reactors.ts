// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts';
import { IReactors } from './IReactors';
import { getReactorMetadata } from './reactor';

/**
 * Implements {@link IReactors}, managing discovery and registration of reactors
 * with the Chronicle Kernel.
 */
export class Reactors implements IReactors {
    private readonly _reactors = new Map<string, Constructor>();

    /**
     * Creates a new {@link Reactors} instance.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(private readonly _clientArtifacts: IClientArtifactsProvider) {}

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
        // Full streaming observation will be added once the observation
        // infrastructure is implemented in the TypeScript client.
    }
}
