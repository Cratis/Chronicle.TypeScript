// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DecoratorType } from './DecoratorType';
import { ArtifactConstructor } from './ArtifactConstructor';
import { IClientArtifactsProvider } from './IClientArtifactsProvider';
import { TypeDiscoverer } from './TypeDiscoverer';

/**
 * Represents the default provider for discovered client artifacts.
 */
export class DefaultClientArtifactsProvider implements IClientArtifactsProvider {
    /** Singleton default provider using the shared {@link TypeDiscoverer}. */
    static readonly default = new DefaultClientArtifactsProvider(TypeDiscoverer.default);

    /**
     * Initializes a new instance of the {@link DefaultClientArtifactsProvider} class.
     * @param discoverer - The discoverer instance that provides discovered types.
     */
    constructor(private readonly discoverer: TypeDiscoverer) {}

    /** @inheritdoc */
    getTypesByDecoratorType(decoratorType: DecoratorType): ArtifactConstructor[] {
        return this.discoverer.getTypesByDecoratorType(decoratorType);
    }
}
