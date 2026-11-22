// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';
import { default_runtime_registration } from './given/default_runtime_registration.fixture.js';
import { defineRuntime, RuntimeModel, runtime_registration } from './given/runtime_registration.fixture.js';

let context: ReturnType<typeof default_runtime_registration>;
beforeEach(() => {
    TypeDiscoverer.default.clear();
    context = default_runtime_registration();
});
afterEach(() => {
    context.dispose();
    TypeDiscoverer.default.clear();
});

describe('when calling model-bound registration after fluent registration', () => {
    it('should reject a plain model rather than accepting it as an already-registered model-bound projection', async () => {
        const plain = runtime_registration();
        await plain.projections.registerFor(RuntimeModel, defineRuntime);
        const original = plain.registerProjection.mock.calls[0][0];

        await expect(plain.projections.registerModelBound(RuntimeModel)).rejects.toThrow("Projection id 'runtime-model' is already registered at runtime");

        expect(plain.registerProjection).toHaveBeenCalledTimes(1);
        expect(plain.registerReadModel).toHaveBeenCalledTimes(1);
        await plain.projections.register();
        expect(plain.registerProjection.mock.calls.map(call => call[0])).toEqual([original, original]);
    });

    it('should also reject a decorated model and retain its original fluent definition on reconnect', async () => {
        const { PropertyModel, store, registerProjection } = context;
        await store.projections.registerFor(PropertyModel, context.define);
        const original = registerProjection.mock.calls[0][0];

        await expect(store.projections.registerModelBound(PropertyModel)).rejects.toThrow("Projection id 'property-runtime' is already registered at runtime");

        expect(registerProjection).toHaveBeenCalledTimes(1);
        await context.reconnect();
        expect(registerProjection.mock.calls.map(call => call[0])).toEqual([original, original]);
    });
});

describe('when calling model-bound registration twice', () => {
    it('should be a no-op only after the matching model-bound definition has been acknowledged', async () => {
        const { PropertyModel, store, registerProjection } = context;
        await store.projections.registerModelBound(PropertyModel);
        const original = registerProjection.mock.calls[0][0];

        await store.projections.registerModelBound(PropertyModel);

        expect(registerProjection).toHaveBeenCalledTimes(1);
        expect(store.projections.getProjectionIdFor(PropertyModel).value).toBe('property-runtime');
        await context.reconnect();
        expect(registerProjection.mock.calls.map(call => call[0])).toEqual([original, original]);
    });
});

describe('when calling fluent registration after model-bound registration', () => {
    it('should reject the same constructor and identifier as a collision without replacing the model-bound definition', async () => {
        const { PropertyModel, store, registerProjection } = context;
        await store.projections.registerModelBound(PropertyModel);
        const original = registerProjection.mock.calls[0][0];

        await expect(store.projections.registerFor(PropertyModel, context.define)).rejects.toThrow("Projection id 'property-runtime' is already registered at runtime");

        expect(registerProjection).toHaveBeenCalledTimes(1);
        await context.reconnect();
        expect(registerProjection.mock.calls.map(call => call[0])).toEqual([original, original]);
    });
});
