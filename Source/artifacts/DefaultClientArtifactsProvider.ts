// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from './IClientArtifactsProvider';
import { DecoratorType } from '../types/DecoratorType';
import { TypeDiscoverer } from '../types/TypeDiscoverer';

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
    get eventTypes(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.EventType);
    }

    /** @inheritdoc */
    get reactors(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.Reactor);
    }

    /** @inheritdoc */
    get reducers(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.Reducer);
    }
}
