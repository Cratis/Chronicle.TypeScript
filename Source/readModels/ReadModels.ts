// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type {
    AppendedEvent,
    ReadModelObserverType
} from '@cratis/chronicle.contracts';
import {
    ReadModelObserverType as ContractReadModelObserverType
} from '@cratis/chronicle.contracts';
import type { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts';
import { toContractsGuid } from '../connection/Guid';
import { ChronicleConnection } from '../connection';
import { EventSequenceId } from '../eventSequences/EventSequenceId';
import { getProjectionMetadata } from '../projections/declarative/projection';
import { hasFromEventMetadata } from '../projections/modelBound/fromEvent';
import { getReducerMetadata } from '../reducers/reducer';
import { JsonSchemaGenerator } from '../schemas';
import { WellKnownSinks } from '../sinks';
import { getReadModelMetadata } from './readModel';
import type { IReadModels } from './IReadModels';
import type { ReadModelChangeset } from './ReadModelChangeset';
import type { ReadModelSnapshot } from './ReadModelSnapshot';

const unlimitedEventCount = BigInt('18446744073709551615');

interface ResolvedReadModel {
    readonly type: Constructor;
    readonly identifier: string;
    readonly eventSequenceId: string;
    readonly observerType: ReadModelObserverType;
    readonly observerIdentifier: string;
    readonly schema: string;
}

/**
 * Implements {@link IReadModels} by working with the Chronicle read-model gRPC service.
 */
export class ReadModels implements IReadModels {
    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {}

    /** @inheritdoc */
    async register<TReadModel>(readModelType?: Constructor<TReadModel>): Promise<void> {
        const readModels = this.resolveReadModels(readModelType);
        if (readModels.length === 0) {
            return;
        }

        await this._connection.readModels.registerMany({
            EventStore: this._eventStore,
            Owner: 1,
            Source: 1,
            ReadModels: readModels.map(readModel => this.toDefinition(readModel))
        });
    }

    /** @inheritdoc */
    async getInstanceById<TReadModel>(readModelType: Constructor<TReadModel>, key: string, sessionId?: string): Promise<TReadModel> {
        const readModel = this.resolveReadModel(readModelType);
        const response = await this._connection.readModels.getInstanceByKey({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModelIdentifier: readModel.identifier,
            EventSequenceId: readModel.eventSequenceId,
            ReadModelKey: key,
            SessionId: sessionId ?? ''
        });

        return this.deserializeReadModel(readModelType, response.ReadModel);
    }

    /** @inheritdoc */
    async getInstances<TReadModel>(readModelType: Constructor<TReadModel>, eventCount: bigint = unlimitedEventCount): Promise<TReadModel[]> {
        const readModel = this.resolveReadModel(readModelType);
        const response = await this._connection.readModels.getAllInstances({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModelIdentifier: readModel.identifier,
            EventSequenceId: readModel.eventSequenceId,
            EventCount: eventCount
        });

        return response.Instances.map(instance => this.deserializeReadModel(readModelType, instance));
    }

    /** @inheritdoc */
    async getSnapshotsById<TReadModel>(readModelType: Constructor<TReadModel>, key: string): Promise<ReadModelSnapshot<TReadModel>[]> {
        const readModel = this.resolveReadModel(readModelType);
        const response = await this._connection.readModels.getSnapshotsByKey({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModelIdentifier: readModel.identifier,
            EventSequenceId: readModel.eventSequenceId,
            ReadModelKey: key
        });

        return response.Snapshots.map(snapshot => ({
            readModel: this.deserializeReadModel(readModelType, snapshot.ReadModel),
            events: (snapshot.Events ?? []) as AppendedEvent[],
            occurred: snapshot.Occurred?.Value ? new Date(snapshot.Occurred.Value) : undefined,
            correlationId: snapshot.CorrelationId
        }));
    }

    /** @inheritdoc */
    async *watch<TReadModel>(readModelType: Constructor<TReadModel>): AsyncIterable<ReadModelChangeset<TReadModel>> {
        const readModel = this.resolveReadModel(readModelType);

        for await (const changeset of this._connection.readModels.watch({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModelIdentifier: readModel.identifier,
            EventSequenceId: readModel.eventSequenceId
        })) {
            yield {
                namespace: changeset.Namespace,
                key: changeset.ModelKey,
                readModel: this.deserializeReadModel(readModelType, changeset.ReadModel),
                removed: changeset.Removed
            };
        }
    }

    /** @inheritdoc */
    async dehydrateSession<TReadModel>(sessionId: string, readModelType: Constructor<TReadModel>, key: string): Promise<void> {
        const readModel = this.resolveReadModel(readModelType);
        await this._connection.readModels.dehydrateSession({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModelIdentifier: readModel.identifier,
            EventSequenceId: readModel.eventSequenceId,
            ReadModelKey: key,
            SessionId: sessionId
        });
    }

    private resolveReadModels<TReadModel>(readModelType?: Constructor<TReadModel>): ResolvedReadModel[] {
        const resolved = new Map<string, ResolvedReadModel>();

        for (const projectionType of this._clientArtifacts.projections) {
            const metadata = getProjectionMetadata(projectionType);
            if (!metadata?.readModelType) {
                continue;
            }

            if (readModelType && metadata.readModelType !== readModelType) {
                continue;
            }

            const readModelMetadata = getReadModelMetadata(metadata.readModelType);
            const identifier = readModelMetadata?.id.value ?? metadata.readModelType.name;
            resolved.set(identifier, {
                type: metadata.readModelType,
                identifier,
                eventSequenceId: metadata.eventSequenceId ?? EventSequenceId.eventLog.value,
                observerType: ContractReadModelObserverType.Projection,
                observerIdentifier: metadata.id.value,
                schema: this.getReadModelSchema(metadata.readModelType, identifier)
            });
        }

        for (const modelBoundType of this._clientArtifacts.readModels) {
            if (!hasFromEventMetadata(modelBoundType)) {
                continue;
            }

            if (readModelType && modelBoundType !== readModelType) {
                continue;
            }

            const metadata = getReadModelMetadata(modelBoundType);
            if (!metadata) {
                continue;
            }

            resolved.set(metadata.id.value, {
                type: modelBoundType,
                identifier: metadata.id.value,
                eventSequenceId: EventSequenceId.eventLog.value,
                observerType: ContractReadModelObserverType.Projection,
                observerIdentifier: metadata.id.value,
                schema: JSON.stringify(metadata.schema)
            });
        }

        for (const reducerType of this._clientArtifacts.reducers) {
            const metadata = getReducerMetadata(reducerType);
            if (!metadata?.readModel) {
                continue;
            }

            if (readModelType && metadata.readModel !== readModelType) {
                continue;
            }

            const readModelMetadata = getReadModelMetadata(metadata.readModel);
            const identifier = readModelMetadata?.id.value ?? metadata.readModel.name;
            resolved.set(identifier, {
                type: metadata.readModel,
                identifier,
                eventSequenceId: metadata.eventSequenceId ?? EventSequenceId.eventLog.value,
                observerType: ContractReadModelObserverType.Reducer,
                observerIdentifier: metadata.id.value,
                schema: this.getReadModelSchema(metadata.readModel, identifier)
            });
        }

        return Array.from(resolved.values());
    }

    private resolveReadModel<TReadModel>(readModelType: Constructor<TReadModel>): ResolvedReadModel {
        const [resolved] = this.resolveReadModels(readModelType);
        if (!resolved) {
            throw new Error(`Unknown read model '${readModelType.name}'. Make sure it is decorated and discoverable.`);
        }

        return resolved;
    }

    private toDefinition(readModel: ResolvedReadModel) {
        return {
            Type: {
                Identifier: readModel.identifier,
                Generation: 1
            },
            ContainerName: readModel.identifier,
            DisplayName: readModel.identifier,
            Sink: {
                ConfigurationId: toContractsGuid(WellKnownSinks.Null),
                TypeId: toContractsGuid(WellKnownSinks.MongoDB)
            },
            Schema: readModel.schema,
            Indexes: [],
            ObserverType: readModel.observerType,
            ObserverIdentifier: readModel.observerIdentifier,
            Owner: 1,
            Source: 1
        };
    }

    private getReadModelSchema(readModelType: Constructor, identifier: string): string {
        const metadata = getReadModelMetadata(readModelType);
        if (metadata) {
            return JSON.stringify(metadata.schema);
        }

        return JSON.stringify(JsonSchemaGenerator.generate(readModelType) ?? JsonSchemaGenerator.createEmptySchema(identifier));
    }

    private deserializeReadModel<TReadModel>(readModelType: Constructor<TReadModel>, json: string): TReadModel {
        const payload = json ? JSON.parse(json) as object : {};
        return Object.assign(Object.create(readModelType.prototype), payload) as TReadModel;
    }
}
