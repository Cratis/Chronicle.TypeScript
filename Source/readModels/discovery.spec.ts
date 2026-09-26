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
    it('should register a property-bound model without file discovery', async () => {
        class DecoratedOnly { value = ''; }
        setFrom(Event)(DecoratedOnly.prototype, 'value');
        setFrom(Event)(DecoratedOnly.prototype, 'value');
        expect(DefaultClientArtifactsProvider.default.readModels.filter(type => type === DecoratedOnly)).toHaveLength(1);
        const { connection, registerMany } = createConnection();
        await new ReadModels('store', 'Default', connection, DefaultClientArtifactsProvider.default, 'sink').register(DecoratedOnly);
        expect(registerMany.mock.calls[0][0].ReadModels[0].Type.Identifier).toBe('DecoratedOnly');
    });

    it('should refuse to query a model-bound read model whose projection was never registered', async () => {
        class RegisteredLate { value = ''; }
        setFrom(Event)(RegisteredLate.prototype, 'value');
        const { connection } = createConnection();
        const readModels = new ReadModels('store', 'Default', connection, DefaultClientArtifactsProvider.default, 'sink', () => false);
        await expect(readModels.findInstanceById(RegisteredLate, 'key')).rejects.toThrow(/register it explicitly before creating the event store/);
    });

    it('should explain how to register an unregistered property-bound model', async () => {
        class NeverRegistered { value = ''; }
        Reflect.defineMetadata('chronicle:projection:setFrom', [{ eventType: Event }], NeverRegistered.prototype, 'value');
        Reflect.defineMetadata('chronicle:typeIntrospection:properties', ['value'], NeverRegistered);
        const { connection } = createConnection();
        await expect(new ReadModels('store', 'Default', connection, DefaultClientArtifactsProvider.default, 'sink').findInstanceById(NeverRegistered, 'key'))
            .rejects.toThrow(/register it explicitly before creating the event store/);
    });

    it('should deduplicate inferred types and retain custom identifiers', async () => {
        const provider = DefaultClientArtifactsProvider.default;
        for (const type of [ModelBound, Projected, Reduced]) {
            expect(provider.readModels.filter(model => model === type)).toHaveLength(1);
        }
        const { connection, registerMany } = createConnection();
        await new ReadModels('store', 'Default', connection, provider, 'sink').register();
        const definitions = registerMany.mock.calls[0][0].ReadModels;
        const byId = new Map(definitions.map((definition: { Type: { Identifier: string } }) => [definition.Type.Identifier, definition]));
        for (const id of ['ModelBound', 'projected-custom', 'Reduced']) {
            expect(byId.has(id)).toBe(true);
        }
        expect(JSON.parse(byId.get('projected-custom').Schema).properties.value.type).toBe('string');
        expect(JSON.parse(byId.get('Reduced').Schema).properties.count.type).toBe('number');
    });

    it('should preserve the deprecated decorator identifier, schema, and discovery', async () => {
        const provider = DefaultClientArtifactsProvider.default;
        expect(provider.readModels).toContain(Legacy);
        const { connection, registerMany } = createConnection();
        await new ReadModels('store', 'Default', connection, provider, 'sink').register();
        const definition = registerMany.mock.calls[0][0].ReadModels.find(
            (model: { Type: { Identifier: string } }) => model.Type.Identifier === 'legacy-id');
        expect(definition).toBeDefined();
        expect(JSON.parse(definition.Schema).properties.value.type).toBe('string');
    });

    it('should explain how to discover an unknown model', async () => {
        class Unknown {}
        const provider = { ...DefaultClientArtifactsProvider.default, readModels: [], projections: [], reducers: [] };
        const { connection } = createConnection();
        await expect(new ReadModels('store', 'Default', connection, provider, 'sink').findInstanceById(Unknown, 'key'))
            .rejects.toThrow('Make sure it is discoverable through a projection, reducer, or model-bound mapping.');
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
