// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from './IClientArtifactsProvider.js';
import { DecoratorType } from '../types/DecoratorType.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { getProjectionMetadata } from '../projections/declarative/projection.js';
import { getReducerMetadata } from '../reducers/reducer.js';

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
    get readModels(): Constructor[] {
        const types = new Set(this.discoverer.getTypesByDecoratorType(DecoratorType.ReadModel));
        for (const projection of this.projections) {
            const type = getProjectionMetadata(projection)?.readModelType;
            if (type) types.add(type);
        }
        for (const reducer of this.reducers) {
            const type = getReducerMetadata(reducer)?.readModel;
            if (type) types.add(type);
        }
        return Array.from(types);
    }

    /** @inheritdoc */
    get reactors(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.Reactor);
    }

    /** @inheritdoc */
    get reducers(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.Reducer);
    }

    /** @inheritdoc */
    get seeders(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.Seeder);
    }

    /** @inheritdoc */
    get constraints(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.Constraint);
    }

    /** @inheritdoc */
    get projections(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.Projection);
    }

    /** @inheritdoc */
    get webhooks(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.Webhook);
    }

    get eventTypeMigrations(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.EventTypeMigration);
    }

    /** @inheritdoc */
    get globalForHandlers(): Constructor[] {
        return this.discoverer.getTypesByDecoratorType(DecoratorType.GlobalForHandler);
    }
}
