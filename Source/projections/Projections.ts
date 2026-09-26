// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { ProjectionOwner, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { Constructor, Guid } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { JobId } from '../jobs/JobId.js';
import { FailedPartition } from '../observation/FailedPartition.js';
import { FailedPartitions } from '../observation/FailedPartitions.js';
import { toObserverRunningState } from '../observation/toObserverRunningState.js';
import { getReadModelId } from '../readModels/readModel.js';
import { assertUniqueReadModelIds } from '../readModels/assertUniqueReadModelIds.js';
import { rootReadModelTypes } from '../readModels/rootReadModelTypes.js';
import { IProjections } from './IProjections.js';
import { getProjectionMetadata } from './declarative/projection.js';
import { getEventSequenceMetadata } from './modelBound/eventSequence.js';
import { isModelBoundProjection } from './modelBound/isModelBoundProjection.js';
import { ProjectionId } from './ProjectionId.js';
import { ProjectionQueryResult } from './ProjectionQueryResult.js';
import { ProjectionState } from './ProjectionState.js';
import { ProjectionDefinitionCompiler } from './ProjectionDefinitionCompiler.js';
import type { ResolvedModelBoundMetadata } from './ResolvedModelBoundMetadata.js';
import { UnableToQueryProjection } from './UnableToQueryProjection.js';

/**
 * Implements {@link IProjections}, managing discovery and registration of projections
 * with the Chronicle Kernel.
 */
export class Projections implements IProjections {
    private readonly _declarative = new Map<string, Constructor>();
    private readonly _modelBound = new Map<string, Constructor>();
    private readonly _failedPartitions: FailedPartitions;

    private readonly _logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/projections' });

    /**
     * Creates a new {@link Projections} instance.
     * @param _eventStore - The event store name.
     * @param _namespace - The event store namespace.
     * @param _connection - Chronicle connection.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     * @param _defaultSinkTypeId - The identifier of the default read model sink.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _defaultSinkTypeId: string
    ) {
        this._failedPartitions = new FailedPartitions(_eventStore, _namespace, _connection);
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._declarative.clear();
        this._modelBound.clear();

        const declarativeTypes = this._clientArtifacts.projections;
        const readModelTypes = rootReadModelTypes(this._clientArtifacts);
        this._logger.debug('Discovering projections', { declarativeCount: declarativeTypes.length, readModelCount: readModelTypes.length });

        for (const type of declarativeTypes) {
            const metadata = getProjectionMetadata(type);
            if (metadata) {
                this._logger.debug('Discovered declarative projection', { projectionId: metadata.id.value, type: type.name });
                this._declarative.set(metadata.id.value, type);
            }
        }

        for (const type of readModelTypes) {
            if (!isModelBoundProjection(type)) {
                continue;
            }

            const metadata = this.resolveModelBoundMetadata(type);
            if (!metadata) {
                this._logger.debug('Read model has @fromEvent but no model-bound metadata resolved', { type: type.name });
                continue;
            }

            this._logger.debug('Discovered model-bound projection', { projectionId: metadata.id.value, type: type.name });
            if (!this._modelBound.has(metadata.id.value)) {
                this._modelBound.set(metadata.id.value, type);
            }
        }

        this._logger.debug('Projection discovery complete', { declarativeCount: this._declarative.size, modelBoundCount: this._modelBound.size });
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._declarative.size === 0 && this._modelBound.size === 0) {
            await this.discover();
        }

        this._logger.info('Registering projections', { declarativeCount: this._declarative.size, modelBoundCount: this._modelBound.size });

        const inferred = this._clientArtifacts.projections
            .map(type => getProjectionMetadata(type)?.readModelType)
            .filter((type): type is Constructor => type !== undefined);
        assertUniqueReadModelIds([...rootReadModelTypes(this._clientArtifacts), ...inferred]);
        const compiled = new ProjectionDefinitionCompiler(this._clientArtifacts, this._defaultSinkTypeId)
            .compile(this._declarative.values(), this._modelBound.values());
        const projections = compiled.definitions;

        if (projections.length === 0) {
            this._logger.info('No projections to register');
            return;
        }

        const readModels = compiled.readModels;
        if (readModels.length > 0) {
            await this._connection.readModels.registerMany({
                EventStore: this._eventStore,
                Owner: 1,
                ReadModels: readModels,
                Source: 1
            });
        }

        for (const projection of projections) {
            const identifier = String(projection.Identifier ?? '<unknown>');
            await this.registerWithRetry(projection, identifier);
        }
    }

    /** @inheritdoc */
    hasFor(projectionId: ProjectionId | string): boolean {
        const id = this.toProjectionIdValue(projectionId);
        return this._declarative.has(id) || this._modelBound.has(id);
    }

    /** @inheritdoc */
    hasForModel(readModelType: Constructor): boolean {
        try {
            this.resolveProjectionIdForModel(readModelType);
            return true;
        } catch {
            return false;
        }
    }

    /** @inheritdoc */
    getProjectionIdFor(readModelType: Constructor): ProjectionId {
        return this.resolveProjectionIdForModel(readModelType);
    }

    /** @inheritdoc */
    async getStateFor(projectionId: ProjectionId | string): Promise<ProjectionState> {
        const id = this.toProjectionIdValue(projectionId);
        const eventSequenceId = this.resolveEventSequenceIdFor(id);

        const response = await this._connection.observers.getObserverInformation({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ObserverId: id,
            EventSequenceId: eventSequenceId
        });

        return {
            runningState: toObserverRunningState(response.RunningState),
            isSubscribed: response.IsSubscribed,
            nextEventSequenceNumber: new EventSequenceNumber(response.NextEventSequenceNumber),
            lastHandledEventSequenceNumber: new EventSequenceNumber(response.LastHandledEventSequenceNumber),
            tailEventSequenceNumber: new EventSequenceNumber(response.TailEventSequenceNumber)
        };
    }

    /** @inheritdoc */
    getStateForModel(readModelType: Constructor): Promise<ProjectionState> {
        return this.getStateFor(this.resolveProjectionIdForModel(readModelType));
    }

    /** @inheritdoc */
    getFailedPartitionsForModel(readModelType: Constructor): Promise<FailedPartition[]> {
        const projectionId = this.resolveProjectionIdForModel(readModelType);
        return this._failedPartitions.getFailedPartitionsFor(projectionId.value);
    }

    /** @inheritdoc */
    async replay(projectionId: ProjectionId | string): Promise<JobId> {
        const id = this.toProjectionIdValue(projectionId);

        const response = await this._connection.observers.replay({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ObserverId: id,

            // The kernel resolves the observer's own event sequence from its identifier - it does not
            // need to be told which one to replay.
            EventSequenceId: ''
        });

        return response.JobId ? JobId.from(response.JobId) : JobId.from(Guid.empty);
    }

    /** @inheritdoc */
    replayForModel(readModelType: Constructor): Promise<JobId> {
        return this.replay(this.resolveProjectionIdForModel(readModelType));
    }

    /** @inheritdoc */
    async query(declaration: string, eventSequenceId: string = EventSequenceId.eventLog.value): Promise<ProjectionQueryResult> {
        const result = await this._connection.projections.preview({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            EventSequenceId: eventSequenceId,
            Declaration: declaration
        });

        if (result.Value1) {
            throw new UnableToQueryProjection(result.Value1.Errors.map(error => error.Message));
        }

        return {
            readModelEntries: result.Value0?.ReadModelEntries ?? []
        };
    }

    private toProjectionIdValue(projectionId: ProjectionId | string): string {
        return typeof projectionId === 'string' ? projectionId : projectionId.value;
    }

    /**
     * Resolves the {@link ProjectionId} of the projection that maintains a specific read model type,
     * from what has already been discovered.
     * @param readModelType - The read model type to resolve for.
     * @returns The resolved {@link ProjectionId}.
     */
    private resolveProjectionIdForModel(readModelType: Constructor): ProjectionId {
        for (const [id, type] of this._modelBound) {
            if (type === readModelType) {
                return new ProjectionId(id);
            }
        }

        for (const [id, type] of this._declarative) {
            const metadata = getProjectionMetadata(type);
            if (metadata?.readModelType === readModelType) {
                return new ProjectionId(id);
            }
        }

        throw new Error(
            `No projection found for read model '${readModelType.name}'. Make sure discover() has run and the ` +
            'read model is model-bound, or its declarative projection() decorator specifies an explicit readModelType.');
    }

    /**
     * Resolves the event sequence identifier a discovered projection reads from, without requiring
     * its full definition to have been built.
     * @param projectionId - The projection identifier to resolve for.
     * @returns The resolved event sequence identifier.
     */
    private resolveEventSequenceIdFor(projectionId: string): string {
        const modelBoundType = this._modelBound.get(projectionId);
        if (modelBoundType) {
            return getEventSequenceMetadata(modelBoundType) ?? EventSequenceId.eventLog.value;
        }

        const declarativeType = this._declarative.get(projectionId);
        if (declarativeType) {
            return getProjectionMetadata(declarativeType)?.eventSequenceId ?? EventSequenceId.eventLog.value;
        }

        return EventSequenceId.eventLog.value;
    }

    private async registerWithRetry(projection: ProjectionDefinition, identifier: string, maxAttempts = 5): Promise<void> {
        let delay = 2000;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this._logger.info('Registering projection', { identifier, readModel: projection.ReadModel, attempt });
                await this._connection.projections.register({
                    EventStore: this._eventStore,
                    Owner: ProjectionOwner.PROJECTION_OWNER_Client,
                    Projections: [projection]
                });
                this._logger.info('Projection registered successfully', { identifier });
                return;
            } catch (error) {
                const msg = String(error);
                const isTransient = msg.includes('UNKNOWN') || msg.includes('UNAVAILABLE') || msg.includes('INTERNAL');
                if (!isTransient || attempt === maxAttempts) {
                    throw new Error(`Failed to register projection '${identifier}' after ${attempt} attempt(s): ${msg}`);
                }
                this._logger.warn('Projection registration failed with transient error, retrying', {
                    identifier,
                    attempt,
                    nextAttemptInMs: delay,
                    error: msg
                });
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, 15000);
            }
        }
    }

    private resolveModelBoundMetadata(type: Constructor): ResolvedModelBoundMetadata | undefined {
        if (isModelBoundProjection(type)) {
            const identifier = getReadModelId(type);
            return {
                id: new ProjectionId(identifier),
                eventSequenceId: getEventSequenceMetadata(type),
                readModelIdentifier: identifier
            };
        }

        return undefined;
    }
}
