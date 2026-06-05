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
import { JsonSerializer } from '@cratis/fundamentals';
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
import type { IMaterializedReadModels } from './IMaterializedReadModels';
import { MaterializedReadModels } from './MaterializedReadModels';
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
    readonly materialized: IMaterializedReadModels;

    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {
        this.materialized = new MaterializedReadModels(_eventStore, _namespace, _connection);
    }

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

        const instance = this.deserializeReadModel(readModelType, response.ReadModel);

        if (readModel.observerType === ContractReadModelObserverType.Reducer && this.schemaHasComplianceMetadata(readModel.schema)) {
            return this.release(readModelType, instance);
        }

        return instance;
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

        const instances = response.Instances.map(instance => this.deserializeReadModel(readModelType, instance));

        if (readModel.observerType === ContractReadModelObserverType.Reducer && this.schemaHasComplianceMetadata(readModel.schema)) {
            return this.releaseMany(readModelType, instances);
        }

        return instances;
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

        const snapshots: ReadModelSnapshot<TReadModel>[] = response.Snapshots.map(snapshot => ({
            readModel: this.deserializeReadModel(readModelType, snapshot.ReadModel),
            events: (snapshot.Events ?? []) as AppendedEvent[],
            occurred: snapshot.Occurred?.Value ? new Date(snapshot.Occurred.Value) : undefined,
            correlationId: snapshot.CorrelationId
        }));

        if (readModel.observerType === ContractReadModelObserverType.Reducer && this.schemaHasComplianceMetadata(readModel.schema)) {
            return this.releaseSnapshotInstances(readModelType, snapshots);
        }

        return snapshots;
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

    /** @inheritdoc */
    async release<TReadModel>(readModelType: Constructor<TReadModel>, instance: TReadModel): Promise<TReadModel> {
        const readModel = this.resolveReadModel(readModelType);
        const schema = this.getReadModelSchema(readModelType, readModel.identifier);
        const payload = JsonSerializer.serialize(instance);
        const subject = this.extractSubject(instance);

        const response = await this._connection.compliance.release({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            Subject: subject,
            Schema: schema,
            Payload: payload
        });

        if (response.HasError) {
            throw new Error(`Failed to release PII: ${response.Error}`);
        }

        return this.deserializeReadModel(readModelType, response.Payload);
    }

    /** @inheritdoc */
    async releaseMany<TReadModel>(readModelType: Constructor<TReadModel>, instances: TReadModel[]): Promise<TReadModel[]> {
        const releasePromises = instances.map(instance => this.release(readModelType, instance));
        return Promise.all(releasePromises);
    }

    private async releaseSnapshotInstances<TReadModel>(readModelType: Constructor<TReadModel>, snapshots: ReadModelSnapshot<TReadModel>[]): Promise<ReadModelSnapshot<TReadModel>[]> {
        return Promise.all(
            snapshots.map(async snapshot => ({
                ...snapshot,
                readModel: await this.release(readModelType, snapshot.readModel)
            }))
        );
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
        if (!json) {
            return Object.create(readModelType.prototype) as TReadModel;
        }
        return JsonSerializer.deserialize(readModelType as Constructor<object>, json) as TReadModel;
    }

    private schemaHasComplianceMetadata(schema: string): boolean {
        try {
            const parsed = JSON.parse(schema) as Record<string, unknown>;
            const properties = parsed.properties as Record<string, Record<string, unknown>> | undefined;
            if (!properties) {
                return false;
            }
            return Object.values(properties).some(
                property => Array.isArray(property.compliance) && (property.compliance as unknown[]).length > 0
            );
        } catch {
            return false;
        }
    }

    private extractSubject<TReadModel>(instance: TReadModel): string {
        // By convention, use the 'id' property as the subject
        const anyInstance = instance as any;
        if (anyInstance.id !== undefined && anyInstance.id !== null) {
            return String(anyInstance.id);
        }
        throw new Error('Read model instance must have an "id" property to serve as the subject for PII release');
    }
}
