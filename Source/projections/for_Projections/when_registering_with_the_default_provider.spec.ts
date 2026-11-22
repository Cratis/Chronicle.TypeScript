// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';
import { projection } from '../declarative/projection.js';
import { fromEvent } from '../modelBound/fromEvent.js';
import { setFrom } from '../modelBound/setFrom.js';
import { default_runtime_registration } from './given/default_runtime_registration.fixture.js';

let context: ReturnType<typeof default_runtime_registration>;
beforeEach(() => {
    TypeDiscoverer.default.clear();
    context = default_runtime_registration();
});
afterEach(() => {
    context.dispose();
    TypeDiscoverer.default.clear();
});

describe('when standard property decorators become discoverable after runtime registration', () => {
    it.each(['fluent', 'model-bound'] as const)('should retain the %s definition through discovery, registration and reconnect', async style => {
        const { artifacts, PropertyModel, store, registerProjection } = context;
        expect(artifacts.readModels).not.toContain(PropertyModel);
        if (style === 'fluent') await store.projections.registerFor(PropertyModel, context.define);
        else await store.projections.registerModelBound(PropertyModel);
        expect(artifacts.readModels).toContain(PropertyModel);
        const original = registerProjection.mock.calls[0][0];

        await store.projections.discover();
        await store.projections.register();
        await context.reconnect();

        expect(registerProjection).toHaveBeenCalledTimes(3);
        expect(registerProjection.mock.calls.map(call => call[0])).toEqual([original, original, original]);
        expect(store.projections.getProjectionIdFor(PropertyModel).value).toBe('property-runtime');
        expect(store.registrationResult.state).toBe('successful');
    });

    it.each(['fluent', 'model-bound'] as const)('should allow later registrations after the %s model is constructed by introspection', async style => {
        const { Added, PropertyModel, store } = context;
        if (style === 'fluent') await store.projections.registerFor(PropertyModel, context.define);
        else await store.projections.registerModelBound(PropertyModel);

        @fromEvent(Added)
        class LaterModel { @field(String) name = ''; }
        await store.projections.registerModelBound(LaterModel);

        expect(store.projections.hasForModel(PropertyModel)).toBe(true);
        expect(store.projections.hasForModel(LaterModel)).toBe(true);
        expect(context.registerProjection).toHaveBeenCalledTimes(2);
    });
});

describe('when explicitly registering an already-discovered class-level model', () => {
    it('should acknowledge it once, then be idempotent for the same constructor and identifier', async () => {
        const { Added, artifacts, store, registerProjection } = context;
        @fromEvent(Added)
        class NameDetails {
            @setFrom(Added)
            @field(String) name = '';
        }
        expect(artifacts.readModels).toContain(NameDetails);
        await store.projections.discover();
        expect(store.projections.hasForModel(NameDetails)).toBe(true);

        await store.projections.registerModelBound(NameDetails);
        await store.projections.registerModelBound(NameDetails);
        expect(registerProjection).toHaveBeenCalledTimes(1);
        await store.projections.discover();
        await store.projections.register();
        await context.reconnect();

        expect(registerProjection).toHaveBeenCalledTimes(3);
        expect(registerProjection.mock.calls[1][0]).toEqual(registerProjection.mock.calls[0][0]);
        expect(registerProjection.mock.calls[2][0]).toEqual(registerProjection.mock.calls[0][0]);
        expect(store.projections.getProjectionIdFor(NameDetails).value).toBe('NameDetails');
    });
});

describe('when another declaration uses the same runtime projection identifier', () => {
    it('should reject a different discovered model constructor rather than treating it as the retained model', async () => {
        const { Added, PropertyModel, store, registerProjection } = context;
        await store.projections.registerModelBound(PropertyModel);
        @fromEvent(Added)
        class DifferentModel { static readonly readModelId = 'property-runtime'; }
        expect(context.artifacts.readModels).toContain(DifferentModel);

        await expect(store.projections.discover()).rejects.toThrow("Projection id 'property-runtime' is already registered at runtime");
        await expect(store.projections.registerModelBound(DifferentModel)).rejects.toThrow('already registered at runtime');
        expect(store.projections.getProjectionIdFor(PropertyModel).value).toBe('property-runtime');
        expect(registerProjection).toHaveBeenCalledTimes(1);
    });

    it('should reject a different constructor that was discovered before the explicit registration', async () => {
        const { Added, PropertyModel, store } = context;
        @fromEvent(Added)
        class DifferentModel { static readonly readModelId = 'property-runtime'; }
        expect(context.artifacts.readModels).toContain(DifferentModel);

        await expect(store.projections.registerModelBound(PropertyModel)).rejects.toThrow("Projection id 'property-runtime' is already discovered");
        expect(context.registerProjection).not.toHaveBeenCalled();
    });

    it('should still reject a separate declarative projection even when it targets the same model', async () => {
        const { PropertyModel, store } = context;
        await store.projections.registerFor(PropertyModel, context.define);
        @projection('property-runtime', PropertyModel)
        class DifferentProjection { define = context.define; }
        expect(context.artifacts.projections).toContain(DifferentProjection);

        await expect(store.projections.discover()).rejects.toThrow("Projection id 'property-runtime' is already registered at runtime");
        expect(context.registerProjection).toHaveBeenCalledTimes(1);
    });
});
