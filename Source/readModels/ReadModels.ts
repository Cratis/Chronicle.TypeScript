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
import { Guid, JsonSerializer } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { toContractsGuid } from '../connection/Guid.js';
import { ChronicleConnection } from '../connection/index.js';
import { ensureQuerySuccess } from '../connection/callResults.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { getProjectionMetadata } from '../projections/declarative/projection.js';
import { hasFromEventMetadata } from '../projections/modelBound/fromEvent.js';
import { hasModelBoundProperties } from '../types/TypeDiscoverer.js';
import { isPassive } from '../projections/modelBound/passive.js';
import { getReducerMetadata } from '../reducers/reducer.js';
import { JsonSchemaGenerator } from '../schemas/index.js';
import { WellKnownSinks } from '../sinks/index.js';
import { getReadModelMetadata, getReadModelId } from './readModel.js';
import { assertUniqueReadModelIds } from './assertUniqueReadModelIds.js';
import type { IMaterializedReadModels } from './IMaterializedReadModels.js';
import { MaterializedReadModels } from './MaterializedReadModels.js';
import { ReadModelSubjectResolver } from './ReadModelSubjectResolver.js';
import type { IReadModels } from './IReadModels.js';
import type { ReadModelChangeset } from './ReadModelChangeset.js';
import type { ReadModelSnapshot } from './ReadModelSnapshot.js';

const unlimitedEventCount = BigInt('18446744073709551615');

interface ResolvedReadModel {
    readonly type: Constructor;
    readonly identifier: string;
    readonly eventSequenceId: string;
    readonly observerType: ReadModelObserverType;
    readonly observerIdentifier: string;
    readonly schema: string;
    readonly isActive: boolean;
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
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _defaultSinkTypeId: string
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

    /**
     * @inheritdoc
     * @deprecated Use {@link findInstanceById} to distinguish an absent instance from a stored one.
     */
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
    async findInstanceById<TReadModel>(readModelType: Constructor<TReadModel>, key: string, sessionId?: string): Promise<TReadModel | null> {
        const readModel = this.resolveReadModel(readModelType);
        const response = await this._connection.readModels.getInstanceByKey({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModelIdentifier: readModel.identifier,
            EventSequenceId: readModel.eventSequenceId,
            ReadModelKey: key,
            SessionId: sessionId ?? ''
        });

        if (!response.ReadModel || response.ReadModel.trim() === 'null') {
            return null;
        }
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
        const response = ensureQuerySuccess('get read model snapshots', await this._connection.readModelExplorer.allSnapshotsForReadModel({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModel: readModel.identifier,
            EventSequenceId: readModel.eventSequenceId,
            ReadModelKey: key,
            Grouping: ''
        }));

        const snapshots: ReadModelSnapshot<TReadModel>[] = response.map(snapshot => ({
            readModel: this.deserializeReadModel(readModelType, snapshot.Instance),
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
            const instance = this.deserializeReadModel(readModelType, changeset.ReadModel);
            const requiresRelease = !changeset.Removed && readModel.observerType === ContractReadModelObserverType.Reducer &&
                this.schemaHasComplianceMetadata(readModel.schema);
            yield {
                namespace: changeset.Namespace,
                key: changeset.ModelKey,
                readModel: requiresRelease ? await this.release(readModelType, instance) : instance,
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
        const subject = this.extractSubject(readModelType, instance);

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
        assertUniqueReadModelIds(this._clientArtifacts.readModels);
        const resolved = new Map<string, ResolvedReadModel>();

        for (const projectionType of this._clientArtifacts.projections) {
            const metadata = getProjectionMetadata(projectionType);
            if (!metadata?.readModelType) {
                continue;
            }

            if (readModelType && metadata.readModelType !== readModelType) {
                continue;
            }

            const identifier = getReadModelId(metadata.readModelType);
            this.addResolved(resolved, {
                type: metadata.readModelType,
                identifier,
                eventSequenceId: metadata.eventSequenceId ?? EventSequenceId.eventLog.value,
                observerType: ContractReadModelObserverType.Projection,
                observerIdentifier: metadata.id.value,
                schema: this.getReadModelSchema(metadata.readModelType, identifier),
                isActive: !isPassive(metadata.readModelType)
            });
        }

        for (const modelBoundType of this._clientArtifacts.readModels) {
            if (!hasFromEventMetadata(modelBoundType) && !hasModelBoundProperties(modelBoundType)) {
                continue;
            }

            if (readModelType && modelBoundType !== readModelType) {
                continue;
            }

            const identifier = getReadModelId(modelBoundType);
            this.addResolved(resolved, {
                type: modelBoundType,
                identifier,
                eventSequenceId: EventSequenceId.eventLog.value,
                observerType: ContractReadModelObserverType.Projection,
                observerIdentifier: identifier,
                schema: this.getReadModelSchema(modelBoundType, identifier),
                isActive: !isPassive(modelBoundType)
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

            const identifier = getReadModelId(metadata.readModel);
            this.addResolved(resolved, {
                type: metadata.readModel,
                identifier,
                eventSequenceId: metadata.eventSequenceId ?? EventSequenceId.eventLog.value,
                observerType: ContractReadModelObserverType.Reducer,
                observerIdentifier: metadata.id.value,
                schema: this.getReadModelSchema(metadata.readModel, identifier),
                isActive: true
            });
        }

        return Array.from(resolved.values());
    }

    private addResolved(models: Map<string, ResolvedReadModel>, model: ResolvedReadModel): void {
        const existing = models.get(model.identifier);
        if (existing && (existing.type !== model.type || existing.observerType !== model.observerType ||
            existing.observerIdentifier !== model.observerIdentifier)) {
            throw new Error(`Read model id '${model.identifier}' has multiple observers or model types.`);
        }
        models.set(model.identifier, model);
    }

    private resolveReadModel<TReadModel>(readModelType: Constructor<TReadModel>): ResolvedReadModel {
        const [resolved] = this.resolveReadModels(readModelType);
        if (!resolved) {
            throw new Error(`Unknown read model '${readModelType.name}'. Make sure it is discoverable through a projection, reducer, or model-bound mapping.`);
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
                ConfigurationId: toContractsGuid(Guid.empty),
                // Passive read models never write to a materialized sink, so they register with the
                // None sink and the kernel resolves them via immediate projection instead of an empty sink.
                TypeId: readModel.isActive ? this._defaultSinkTypeId : WellKnownSinks.None
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

    private extractSubject<TReadModel>(readModelType: Constructor<TReadModel>, instance: TReadModel): string {
        const subject = ReadModelSubjectResolver.resolveFrom(readModelType, instance);
        if (subject !== undefined) {
            return subject;
        }
        throw new Error('Read model instance must have a property decorated with @subject() or an "id" property to serve as the subject for PII release');
    }
}
