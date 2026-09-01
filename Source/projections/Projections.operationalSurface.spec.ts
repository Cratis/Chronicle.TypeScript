// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { ObserverRunningState } from '../observation/ObserverRunningState';
import { eventType } from '../events/eventTypeDecorator';
import { readModel } from '../readModels/readModel';
import { eventSequence } from './modelBound/eventSequence';
import { fromEvent } from './modelBound/fromEvent';
import { projection } from './declarative/projection';
import type { IProjectionBuilderFor } from './declarative/IProjectionBuilderFor';
import type { IProjectionFor } from './declarative/IProjectionFor';
import { Projections } from './Projections';
import { UnableToQueryProjection } from './UnableToQueryProjection';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

class OpStateChanged {
    value!: string;
}
eventType()(OpStateChanged);

class OpSummary {
    id!: string;
    value!: string;
}
fromEvent(OpStateChanged)(OpSummary);
eventSequence('custom-op-sequence')(OpSummary);
readModel()(OpSummary);

class UndiscoveredSummary {
    id!: string;
}
readModel()(UndiscoveredSummary);

class DeclarativeReadModel {
    id!: string;
}
readModel()(DeclarativeReadModel);

class DeclarativeSummaryProjection implements IProjectionFor<DeclarativeReadModel> {
    // discover() never calls define() - only register() does - so a no-op body is sufficient here.
    define(_builder: IProjectionBuilderFor<DeclarativeReadModel>): void {}
}
projection('DeclarativeSummary', DeclarativeReadModel)(DeclarativeSummaryProjection);

function wireObserverInformation() {
    return {
        RunningState: 1, // Active
        IsSubscribed: true,
        NextEventSequenceNumber: 5n,
        LastHandledEventSequenceNumber: 4n,
        TailEventSequenceNumber: 4n
    };
}

async function createDiscoveredProjections() {
    const getObserverInformation = vi.fn().mockResolvedValue(wireObserverInformation());
    const replay = vi.fn().mockResolvedValue({ JobId: '11111111-1111-1111-1111-111111111111' });
    const getFailedPartitions = vi.fn().mockResolvedValue({ items: [] });
    const preview = vi.fn().mockResolvedValue({ Value0: { ReadModelEntries: ['{"id":"1"}'] } });
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const registerManyMock = vi.fn().mockResolvedValue(undefined);

    const connection = {
        observers: { getObserverInformation, replay },
        failedPartitions: { getFailedPartitions },
        projections: { register: registerMock, preview },
        readModels: { registerMany: registerManyMock }
    } as unknown as ChronicleConnection;

    const clientArtifacts: IClientArtifactsProvider = {
        eventTypes: [],
        readModels: [OpSummary, UndiscoveredSummary, DeclarativeReadModel] as unknown as IClientArtifactsProvider['readModels'],
        reactors: [],
        reducers: [],
        seeders: [],
        constraints: [],
        projections: [DeclarativeSummaryProjection] as unknown as IClientArtifactsProvider['projections'],
        webhooks: [],
        eventTypeMigrations: []
    };

    const projections = new Projections('test-store', 'test-namespace', connection, clientArtifacts, 'test-sink');
    await projections.discover();

    return { projections, getObserverInformation, replay, getFailedPartitions, preview };
}

describe('Projections operational surface', () => {
    describe('when checking hasFor with a discovered projection identifier', () => {
        it('should return true', async () => {
            const { projections } = await createDiscoveredProjections();
            expect(projections.hasFor('OpSummary')).toBe(true);
        });
    });

    describe('when checking hasFor with an unknown projection identifier', () => {
        it('should return false', async () => {
            const { projections } = await createDiscoveredProjections();
            expect(projections.hasFor('unknown-projection')).toBe(false);
        });
    });

    describe('when checking hasForModel for a discovered model-bound read model', () => {
        it('should return true', async () => {
            const { projections } = await createDiscoveredProjections();
            expect(projections.hasForModel(OpSummary)).toBe(true);
        });
    });

    describe('when checking hasForModel for an undiscovered read model', () => {
        it('should return false', async () => {
            const { projections } = await createDiscoveredProjections();
            expect(projections.hasForModel(UndiscoveredSummary)).toBe(false);
        });
    });

    describe('when getting the projection identifier for a model-bound read model', () => {
        it('should resolve the read model identifier', async () => {
            const { projections } = await createDiscoveredProjections();
            expect(projections.getProjectionIdFor(OpSummary).value).toBe('OpSummary');
        });
    });

    describe('when getting the projection identifier for a declarative projection with an explicit read model type', () => {
        it('should resolve the declared projection identifier', async () => {
            const { projections } = await createDiscoveredProjections();
            expect(projections.getProjectionIdFor(DeclarativeReadModel).value).toBe('DeclarativeSummary');
        });
    });

    describe('when getting the projection identifier for an undiscovered read model', () => {
        it('should throw', async () => {
            const { projections } = await createDiscoveredProjections();
            expect(() => projections.getProjectionIdFor(UndiscoveredSummary)).toThrow();
        });
    });

    describe('when getting state for a projection by identifier', () => {
        it('should call GetObserverInformation and map the response', async () => {
            const { projections, getObserverInformation } = await createDiscoveredProjections();

            const state = await projections.getStateFor('OpSummary');

            expect(getObserverInformation).toHaveBeenCalledTimes(1);
            const request = getObserverInformation.mock.calls[0][0];
            expect(request.EventStore).toEqual('test-store');
            expect(request.Namespace).toEqual('test-namespace');
            expect(request.ObserverId).toEqual('OpSummary');

            expect(state.runningState).toBe(ObserverRunningState.Active);
            expect(state.isSubscribed).toBe(true);
            expect(state.nextEventSequenceNumber.value).toEqual(5n);
            expect(state.lastHandledEventSequenceNumber.value).toEqual(4n);
            expect(state.tailEventSequenceNumber.value).toEqual(4n);
        });
    });

    describe('when getting state for a model-bound read model with a custom event sequence', () => {
        it('should resolve the identifier and pass the model-declared event sequence', async () => {
            const { projections, getObserverInformation } = await createDiscoveredProjections();

            await projections.getStateForModel(OpSummary);

            const request = getObserverInformation.mock.calls[0][0];
            expect(request.ObserverId).toEqual('OpSummary');
            expect(request.EventSequenceId).toEqual('custom-op-sequence');
        });
    });

    describe('when getting failed partitions for a model-bound read model', () => {
        it('should call GetFailedPartitions with the resolved projection identifier', async () => {
            const { projections, getFailedPartitions } = await createDiscoveredProjections();

            await projections.getFailedPartitionsForModel(OpSummary);

            expect(getFailedPartitions).toHaveBeenCalledTimes(1);
            const request = getFailedPartitions.mock.calls[0][0];
            expect(request.ObserverId).toEqual('OpSummary');
        });
    });

    describe('when replaying a projection by identifier', () => {
        it('should call Replay and parse the returned job id', async () => {
            const { projections, replay } = await createDiscoveredProjections();

            const jobId = await projections.replay('OpSummary');

            expect(replay).toHaveBeenCalledTimes(1);
            const request = replay.mock.calls[0][0];
            expect(request.ObserverId).toEqual('OpSummary');
            expect(jobId.toString()).toEqual('11111111-1111-1111-1111-111111111111');
        });
    });

    describe('when replaying a projection that is not replayable', () => {
        it('should resolve to a not-set job id', async () => {
            const { projections, replay } = await createDiscoveredProjections();
            replay.mockResolvedValueOnce({ JobId: '' });

            const jobId = await projections.replay('OpSummary');

            expect(jobId.value.toString()).toEqual('00000000-0000-0000-0000-000000000000');
        });
    });

    describe('when replaying a model-bound read model', () => {
        it('should resolve the identifier and replay it', async () => {
            const { projections, replay } = await createDiscoveredProjections();

            await projections.replayForModel(OpSummary);

            const request = replay.mock.calls[0][0];
            expect(request.ObserverId).toEqual('OpSummary');
        });
    });

    describe('when querying a projection declaration', () => {
        it('should call Preview and return the read model entries', async () => {
            const { projections, preview } = await createDiscoveredProjections();

            const result = await projections.query('projection Orders\n  from OpStateChanged');

            expect(preview).toHaveBeenCalledTimes(1);
            const request = preview.mock.calls[0][0];
            expect(request.EventSequenceId).toEqual('event-log');
            expect(result.readModelEntries).toEqual(['{"id":"1"}']);
        });
    });

    describe('when querying a projection declaration with a custom event sequence', () => {
        it('should pass the given event sequence identifier', async () => {
            const { projections, preview } = await createDiscoveredProjections();

            await projections.query('projection Orders\n  from OpStateChanged', 'inbox');

            const request = preview.mock.calls[0][0];
            expect(request.EventSequenceId).toEqual('inbox');
        });
    });

    describe('when querying a projection declaration that fails to parse', () => {
        it('should throw UnableToQueryProjection with the syntax errors', async () => {
            const { projections, preview } = await createDiscoveredProjections();
            preview.mockResolvedValueOnce({
                Value1: { Errors: [{ Message: 'Unexpected token', Line: 2, Column: 3 }] }
            });

            await expect(projections.query('projection Bad')).rejects.toThrow(UnableToQueryProjection);
        });
    });
});
