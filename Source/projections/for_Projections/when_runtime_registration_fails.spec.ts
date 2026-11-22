// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { Added, BoundModel, defineRuntime, RuntimeModel, runtime_registration } from './given/runtime_registration.fixture.js';

function expectNotRetained(context: ReturnType<typeof runtime_registration>): void {
    expect(context.projections.hasFor('runtime-model')).toBe(false);
    expect(context.projections.hasForModel(RuntimeModel)).toBe(false);
    expect(() => context.projections.getProjectionIdFor(RuntimeModel)).toThrow('No projection found for read model');
}

describe('when runtime registration conflicts with discovery', () => {
    it('should reject a runtime identifier already used by a discovered model-bound projection', async () => {
        const context = runtime_registration();
        context.artifacts.readModels.push(BoundModel);
        await expect(context.projections.registerFor(RuntimeModel, defineRuntime, 'BoundModel')).rejects.toThrow("Projection id 'BoundModel' is already discovered");
        expect(context.registerReadModel).not.toHaveBeenCalled();
        expect(context.registerProjection).not.toHaveBeenCalled();
    });

    it('should reject a discovery refresh that tries to overwrite a runtime identifier', async () => {
        const context = runtime_registration();
        await context.projections.registerFor(RuntimeModel, defineRuntime, 'BoundModel');
        context.artifacts.readModels.push(BoundModel);
        await expect(context.projections.discover()).rejects.toThrow("Projection id 'BoundModel' is already registered at runtime");
        expect(context.projections.getProjectionIdFor(RuntimeModel).value).toBe('BoundModel');
    });
});

describe('when runtime identifiers conflict', () => {
    it('should reject a second registration without replacing the retained definition', async () => {
        const context = runtime_registration();
        await context.projections.registerFor(RuntimeModel, defineRuntime);
        await expect(context.projections.registerFor(RuntimeModel, builder => builder.passive())).rejects.toThrow('already registered at runtime');
        await context.projections.register();
        expect(context.registerProjection).toHaveBeenCalledTimes(2);
        expect(context.registerProjection.mock.calls[1][0]).toEqual(context.registerProjection.mock.calls[0][0]);
    });

    it('should reserve in-flight identifiers and release them on failure', async () => {
        const context = runtime_registration();
        let rejectRegistration!: (error: Error) => void;
        let started!: () => void;
        const pending = new Promise<void>(resolve => { started = resolve; });
        context.registerProjection.mockImplementationOnce(() => {
            started();
            return new Promise((_resolve, reject) => { rejectRegistration = reject; });
        });
        const registration = context.projections.registerFor(RuntimeModel, defineRuntime).catch(error => error);
        await pending;
        expectNotRetained(context);
        await expect(context.projections.registerFor(RuntimeModel, defineRuntime)).rejects.toThrow('already registered at runtime');
        rejectRegistration(new Error('Rejected declaration'));
        expect(await registration).toBeInstanceOf(Error);
        await context.projections.registerFor(RuntimeModel, defineRuntime);
        expect(context.projections.hasForModel(RuntimeModel)).toBe(true);
    });

    it('should refuse a second projection for the same read model', async () => {
        const context = runtime_registration();
        await context.projections.registerFor(RuntimeModel, defineRuntime);
        await expect(context.projections.registerFor(RuntimeModel, defineRuntime, 'another')).rejects.toThrow('already has a projection');
        expect(context.registerProjection).toHaveBeenCalledTimes(1);
    });
});

describe('when the kernel rejects runtime registration', () => {
    it('should surface the failure without retaining a definition, and allow a later retry', async () => {
        const context = runtime_registration();
        context.registerProjection.mockRejectedValueOnce(new Error('Invalid declaration'));
        await expect(context.projections.registerFor(RuntimeModel, defineRuntime)).rejects.toThrow('Invalid declaration');
        expectNotRetained(context);
        await context.projections.register();
        expect(context.registerProjection).toHaveBeenCalledTimes(1);
        await context.projections.registerFor(RuntimeModel, defineRuntime);
        expect(context.projections.hasForModel(RuntimeModel)).toBe(true);
    });

    it('should not retain anything when read model registration fails', async () => {
        const context = runtime_registration();
        context.registerReadModel.mockRejectedValueOnce(new Error('Invalid schema'));
        await expect(context.projections.registerFor(RuntimeModel, defineRuntime)).rejects.toThrow('Invalid schema');
        expectNotRetained(context);
        expect(context.registerProjection).not.toHaveBeenCalled();
    });
});

describe('when validating an explicit runtime projection', () => {
    it('should surface existing builder validation before contacting the kernel', async () => {
        const context = runtime_registration();
        await expect(context.projections.registerFor(RuntimeModel, builder => {
            builder.from(Added, from => from.usingKeyFromContext('unknownContextProperty'));
        })).rejects.toThrow('unknownContextProperty');
        expectNotRetained(context);
        expect(context.registerReadModel).not.toHaveBeenCalled();
        expect(context.registerProjection).not.toHaveBeenCalled();
    });

    it('should refuse a type without model-bound decorators', async () => {
        const context = runtime_registration();
        await expect(context.projections.registerModelBound(RuntimeModel)).rejects.toThrow('has no model-bound projection');
        expectNotRetained(context);
        expect(context.registerReadModel).not.toHaveBeenCalled();
    });
});
