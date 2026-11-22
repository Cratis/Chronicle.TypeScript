// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, describe, expect, it } from 'vitest';
import { WellKnownSinks } from '../../sinks/WellKnownSinks.js';
import { BoundModel, defineRuntime, RuntimeModel, runtime_registration } from './given/runtime_registration.fixture.js';

describe('when registering a fluent projection explicitly at runtime', () => {
    let context: ReturnType<typeof runtime_registration>;
    beforeEach(async () => {
        context = runtime_registration();
        await context.projections.registerFor(RuntimeModel, defineRuntime);
    });

    it('should send the compiled projection to the kernel', () => {
        expect(context.registerProjection).toHaveBeenCalledWith(expect.objectContaining({
            EventStore: 'store', Projections: [expect.objectContaining({ Identifier: 'runtime-model', ReadModel: 'runtime-model', IsActive: true })]
        }));
    });

    it('should register the explicit model schema and observer association', () => {
        const model = context.registerReadModel.mock.calls[0][0].ReadModels[0];
        expect(model).toMatchObject({ Type: { Identifier: 'runtime-model' }, ObserverIdentifier: 'runtime-model' });
        expect(JSON.parse(model.Schema).properties).toHaveProperty('name');
    });

    it('should associate the acknowledged projection with its read model', async () => {
        expect(context.projections.hasFor('runtime-model')).toBe(true);
        expect(context.projections.hasForModel(RuntimeModel)).toBe(true);
        expect(context.projections.getProjectionIdFor(RuntimeModel).value).toBe('runtime-model');
        await context.projections.getStateForModel(RuntimeModel);
        expect(context.getState).toHaveBeenCalledWith(expect.objectContaining({ ObserverId: 'runtime-model', EventSequenceId: 'event-log' }));
    });

    it('should retain it through discovery and parameterless registration', async () => {
        await context.projections.discover();
        await context.projections.register();
        expect(context.registerProjection).toHaveBeenCalledTimes(2);
        expect(context.registerProjection.mock.calls[1][0]).toEqual(context.registerProjection.mock.calls[0][0]);
        expect(context.registerReadModel.mock.calls[1][0]).toEqual(context.registerReadModel.mock.calls[0][0]);
    });
});

describe('when registering a passive runtime projection with an explicit identifier', () => {
    it('should preserve the identifier, event sequence, and on-demand sink', async () => {
        const context = runtime_registration();
        await context.projections.registerFor(RuntimeModel, builder => {
            defineRuntime(builder);
            builder.passive().fromEventSequence('custom-sequence');
        }, 'explicit-runtime');
        expect(context.projections.getProjectionIdFor(RuntimeModel).value).toBe('explicit-runtime');
        expect(context.registerReadModel.mock.calls[0][0].ReadModels[0].Sink.TypeId).toBe(WellKnownSinks.None);
        await context.projections.getStateForModel(RuntimeModel);
        expect(context.getState).toHaveBeenCalledWith(expect.objectContaining({ ObserverId: 'explicit-runtime', EventSequenceId: 'custom-sequence' }));
    });
});

describe('when registering a model-bound type explicitly at runtime', () => {
    it('should compile decorators and retain the projection independently of discovery', async () => {
        const context = runtime_registration();
        await context.projections.registerModelBound(BoundModel);
        expect(context.registerProjection).toHaveBeenCalledWith(expect.objectContaining({
            Projections: [expect.objectContaining({ Identifier: 'BoundModel', ReadModel: 'BoundModel', From: expect.any(Array) })]
        }));
        expect(context.registerReadModel.mock.calls[0][0].ReadModels[0].ObserverIdentifier).toBe('BoundModel');
        expect(context.projections.getProjectionIdFor(BoundModel).value).toBe('BoundModel');
        await context.projections.discover();
        await context.projections.register();
        expect(context.registerProjection).toHaveBeenCalledTimes(2);
        expect(context.projections.hasForModel(BoundModel)).toBe(true);
    });
});
