// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import type { ChronicleConnection } from '../connection/ChronicleConnection.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { Projections } from '../projections/Projections.js';
import { setFrom } from '../projections/modelBound/setFrom.js';
import { DecoratorType } from '../types/DecoratorType.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { ReadModels } from './ReadModels.js';

@eventType('cold-registration-event')
class Changed { @field(String) value!: string; }

let constructions = 0;
class PropertyOnly {
    @setFrom(Changed, 'value')
    @field(String)
    value = '';

    constructor() { constructions++; }
}

describe('when discovering a standard-decorated property-only read model', () => {
    it('should register and query the model before any instance has been constructed', async () => {
        expect(constructions).toBe(0);
        const discoverer = new TypeDiscoverer(async () => ['models.ts'], async () => ({ PropertyOnly }));
        await discoverer.discover('models.ts');
        expect(constructions).toBe(0);

        const provider = new DefaultClientArtifactsProvider(discoverer);
        const registerMany = vi.fn().mockResolvedValue({});
        const register = vi.fn().mockResolvedValue({});
        const getInstanceByKey = vi.fn().mockResolvedValue({ ReadModel: '{"value":"stored"}' });
        const connection = { readModels: { registerMany, getInstanceByKey }, projections: { register } } as unknown as ChronicleConnection;
        const projections = new Projections('store', 'Default', connection, provider, 'sink');
        await projections.register();
        const readModels = new ReadModels('store', 'Default', connection, provider, 'sink', type => projections.hasForModel(type));
        const result = await readModels.findInstanceById(PropertyOnly, 'id');

        expect(registerMany.mock.calls[0][0].ReadModels.some((model: { Type: { Identifier: string } }) => model.Type.Identifier === 'PropertyOnly')).toBe(true);
        expect(register.mock.calls.some(call => call[0].Projections[0].ReadModel === 'PropertyOnly')).toBe(true);
        expect(getInstanceByKey).toHaveBeenCalledWith(expect.objectContaining({ ReadModelIdentifier: 'PropertyOnly', ReadModelKey: 'id' }));
        expect(result?.value).toBe('stored');
    });

    it('should register an explicitly supplied model without glob discovery or construction', async () => {
        class ExplicitModel {
            @setFrom(Changed)
            @field(String)
            value = '';
        }
        const discoverer = new TypeDiscoverer();
        discoverer.register(DecoratorType.ReadModel, ExplicitModel);
        const provider = new DefaultClientArtifactsProvider(discoverer);
        const registerMany = vi.fn().mockResolvedValue({});
        const register = vi.fn().mockResolvedValue({});
        const connection = { readModels: { registerMany }, projections: { register } } as unknown as ChronicleConnection;

        await new Projections('store', 'Default', connection, provider, 'sink').register();

        expect(registerMany.mock.calls[0][0].ReadModels.some((model: { Type: { Identifier: string } }) => model.Type.Identifier === 'ExplicitModel')).toBe(true);
        expect(register.mock.calls.some(call => call[0].Projections[0].ReadModel === 'ExplicitModel')).toBe(true);
    });

    it('should not register the same model again after its first construction', async () => {
        const discoverer = new TypeDiscoverer(async () => ['models.ts'], async () => ({ PropertyOnly }));
        await discoverer.discover('models.ts');
        const provider = new DefaultClientArtifactsProvider(discoverer);
        const registerMany = vi.fn().mockResolvedValue({});
        const register = vi.fn().mockResolvedValue({});
        const connection = { readModels: { registerMany }, projections: { register } } as unknown as ChronicleConnection;
        await new Projections('store', 'Default', connection, provider, 'sink').register();
        const registered = registerMany.mock.calls.length;
        const registeredProjections = register.mock.calls.length;

        new PropertyOnly();
        new PropertyOnly();

        expect(provider.readModels.filter(type => type === PropertyOnly)).toHaveLength(1);
        expect(registerMany).toHaveBeenCalledTimes(registered);
        expect(register).toHaveBeenCalledTimes(registeredProjections);
    });
});
