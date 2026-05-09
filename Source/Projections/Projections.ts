// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
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

    /**
     * Creates a new {@link Projections} instance.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(private readonly _clientArtifacts: IClientArtifactsProvider) {}

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
        // added once the projection engine contract supports TypeScript clients.
    }
}
