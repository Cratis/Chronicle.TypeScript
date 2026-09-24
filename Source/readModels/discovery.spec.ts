// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import type { ChronicleConnection } from '../connection/index.js';
import { projection } from '../projections/declarative/projection.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { setFrom } from '../projections/modelBound/setFrom.js';
import { Projections } from '../projections/Projections.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { reducer } from '../reducers/reducer.js';
import { ReadModels } from './ReadModels.js';
import { readModel } from './readModel.js';

@eventType('discovery-event')
class Event { @field(String) value!: string; }
@fromEvent(Event)
class ModelBound {
    @field(String) value!: string;
}
class Projected {
    static readonly readModelId = 'projected-custom';
    @field(String) value!: string;
}
@projection('projected-observer', Projected)
class ProjectedObserver {
    define() {}
}
class Reduced {
    @field(Number) count!: number;
}
@reducer('reduced-observer', undefined, Reduced)
class ReducedObserver {}
@readModel('legacy-id')
@fromEvent(Event)
class Legacy {
    @field(String) value!: string;
}
class MappedOnly {
    @field(String)
    @setFrom(Event)
    value!: string;
}

function createConnection() {
    const registerMany = vi.fn().mockResolvedValue({});
    const register = vi.fn().mockResolvedValue({});
    const connection = { readModels: { registerMany }, projections: { register } } as unknown as ChronicleConnection;
    return { connection, registerMany, register };
}

describe('when discovering read models from observers', () => {
    it('should discover and register an exported property-bound model without a class decorator', async () => {
        const discoverer = new TypeDiscoverer(async () => ['virtual.ts'], async () => ({ MappedOnly }));
        await discoverer.discover('virtual');
        const provider = new DefaultClientArtifactsProvider(discoverer);
        expect(provider.readModels).toContain(MappedOnly);
        const { connection, registerMany, register } = createConnection();
        const projections = new Projections('store', 'Default', connection, provider, 'sink');
        await projections.register();
        const definition = registerMany.mock.calls[0][0].ReadModels.find(
            (model: { Type: { Identifier: string } }) => model.Type.Identifier === 'MappedOnly');
        expect(definition).toBeDefined();
        expect(JSON.parse(definition.Schema).properties.value.type).toBe('string');
        expect(register.mock.calls.some(call => call[0].Projections[0].ReadModel === 'MappedOnly')).toBe(true);
    });
    it('should deduplicate inferred types and retain decorated and custom identifiers', async () => {
        const provider = DefaultClientArtifactsProvider.default;
        for (const type of [ModelBound, Projected, Reduced, Legacy]) {
            expect(provider.readModels.filter(model => model === type)).toHaveLength(1);
        }
        const { connection, registerMany } = createConnection();
        await new ReadModels('store', 'Default', connection, provider, 'sink').register();
        const definitions = registerMany.mock.calls[0][0].ReadModels;
        const byId = new Map(definitions.map((definition: { Type: { Identifier: string } }) => [definition.Type.Identifier, definition]));
        for (const id of ['ModelBound', 'projected-custom', 'Reduced', 'legacy-id']) {
            expect(byId.has(id)).toBe(true);
        }
        expect(JSON.parse(byId.get('projected-custom').Schema).properties.value.type).toBe('string');
        expect(JSON.parse(byId.get('Reduced').Schema).properties.count.type).toBe('number');
    });

    it('should reject two distinct models with the same identifier before registration', async () => {
        class First { static readonly readModelId = 'collision'; }
        class Second { static readonly readModelId = 'collision'; }
        const provider = { ...DefaultClientArtifactsProvider.default, readModels: [First, Second], projections: [], reducers: [] };
        const { connection, registerMany } = createConnection();
        await expect(new ReadModels('store', 'Default', connection, provider, 'sink').register()).rejects.toThrow(/collision/);
        expect(registerMany).not.toHaveBeenCalled();
    });
});
