// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { Projections } from '../projections/Projections.js';
import { projection } from '../projections/declarative/projection.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { entersOn } from '../projections/modelBound/entersOn.js';
import { variantOf } from '../projections/modelBound/variantOf.js';
import { reducer } from '../reducers/reducer.js';
import { Reducers } from '../reducers/Reducers.js';
import { index } from './indexDecorator.js';

class IndexedEvent {}
eventType('indexed-event')(IndexedEvent);

class DeclarativeModel {
    @field(String) @index() reference!: string;
}
@projection('indexed-declarative', DeclarativeModel)
class DeclarativeProjection {
    define(): void {}
}

@fromEvent(IndexedEvent)
class ModelBoundModel {
    @field(String) @index() reference!: string;
}

class VariantIdentity {}
@variantOf(VariantIdentity, 'id')
@entersOn(IndexedEvent)
@fromEvent(IndexedEvent)
class IndexedVariant {
    @field(String) id!: string;
    @field(String) @index() reference!: string;
}

class ReducedModel {
    @field(String) @index() reference!: string;
}
@reducer('indexed-reducer', undefined, ReducedModel)
class IndexedReducer {}

function artifacts(readModels: IClientArtifactsProvider['readModels'] = [], projections: IClientArtifactsProvider['projections'] = [], reducers: IClientArtifactsProvider['reducers'] = []): IClientArtifactsProvider {
    return {
        eventTypes: [], readModels, projections, reducers, reactors: [], seeders: [], constraints: [],
        webhooks: [], eventTypeMigrations: [], globalForHandlers: []
    };
}

function connection() {
    const registerMany = vi.fn().mockResolvedValue({});
    const value = {
        readModels: { registerMany },
        projections: { register: vi.fn().mockResolvedValue({}) },
        reducers: { observe: vi.fn().mockImplementation(async function* () {}) }
    } as unknown as ChronicleConnection;
    return { value, registerMany };
}

function indexesFor(registerMany: ReturnType<typeof vi.fn>, identifier: string) {
    const definitions = registerMany.mock.calls[0][0].ReadModels as Array<{ Type: { Identifier: string }; Indexes: unknown[] }>;
    return definitions.find(definition => definition.Type.Identifier === identifier)?.Indexes;
}

describe('when registering indexed read models through the startup paths', () => {
    it('should send indexes for a declarative projection', async () => {
        const { value, registerMany } = connection();
        await new Projections('store', 'Default', value, artifacts([], [DeclarativeProjection]), 'sink').register();
        expect(indexesFor(registerMany, 'DeclarativeModel')).toEqual([{ PropertyPath: 'reference' }]);
    });

    it('should send indexes for a model-bound projection', async () => {
        const { value, registerMany } = connection();
        await new Projections('store', 'Default', value, artifacts([ModelBoundModel]), 'sink').register();
        expect(indexesFor(registerMany, 'ModelBoundModel')).toEqual([{ PropertyPath: 'reference' }]);
    });

    it('should send indexes for a model-bound variant', async () => {
        const { value, registerMany } = connection();
        await new Projections('store', 'Default', value, artifacts([IndexedVariant]), 'sink').register();
        expect(indexesFor(registerMany, 'IndexedVariant')).toEqual([{ PropertyPath: 'reference' }]);
    });

    it('should send indexes for a reducer read model', async () => {
        const { value, registerMany } = connection();
        const reducers = new Reducers(artifacts([], [], [IndexedReducer]), value, 'store', 'Default', new ConnectionLifecycle(), 'sink');
        await reducers.register();
        reducers.dispose();
        expect(indexesFor(registerMany, 'ReducedModel')).toEqual([{ PropertyPath: 'reference' }]);
    });
});
