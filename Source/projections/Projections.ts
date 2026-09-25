// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import {
    AutoMap,
    ProjectionOwner
} from '@cratis/chronicle.contracts';
import { Constructor, Guid } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { toContractsGuid } from '../connection/Guid.js';
import { WellKnownSinks } from '../sinks/index.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { JobId } from '../jobs/JobId.js';
import { FailedPartition } from '../observation/FailedPartition.js';
import { FailedPartitions } from '../observation/FailedPartitions.js';
import { toObserverRunningState } from '../observation/toObserverRunningState.js';
import { getReadModelMetadata } from '../readModels/index.js';
import { getReadModelId } from '../readModels/readModel.js';
import { assertUniqueReadModelIds } from '../readModels/assertUniqueReadModelIds.js';
import { JsonSchemaGenerator } from '../schemas/index.js';
import { TypeIntrospector } from '../types/index.js';
import { hasModelBoundProperties } from '../types/TypeDiscoverer.js';
import { IProjections } from './IProjections.js';
import { constantValueExpression } from './constantValueExpression.js';
import { getProjectionMetadata } from './declarative/projection.js';
import { ProjectionBuilderFor } from './declarative/ProjectionBuilderFor.js';
import type { IProjectionFor } from './declarative/IProjectionFor.js';
import {
    applyPropertyMappings,
    buildChildrenEntry,
    buildNestedEntry,
    ChildrenDefinitionLike,
    ContractEventType,
    ensureFromEntry,
    FromRecord,
    getEventTypeMapKey,
    toContractEventType
} from './modelBound/childrenAndNestedBuilder.js';
import { getChildrenFromMetadata } from './modelBound/childrenFrom.js';
import { getClearWithPropertyMetadata } from './modelBound/clearWith.js';
import { getEventSequenceMetadata } from './modelBound/eventSequence.js';
import { getFromAllMetadata } from './modelBound/fromAll.js';
import { getFromEveryMetadata } from './modelBound/fromEvery.js';
import { getFromEventMetadata, hasFromEventMetadata } from './modelBound/fromEvent.js';
import { getJoinMetadata } from './modelBound/join.js';
import { isNoAutoMap, isPropertyNoAutoMap } from './modelBound/noAutoMap.js';
import { ProjectionId } from './ProjectionId.js';
import { ProjectionQueryResult } from './ProjectionQueryResult.js';
import { ProjectionState } from './ProjectionState.js';
import { isNested } from './modelBound/nested.js';
import { isNotRewindable } from './modelBound/notRewindable.js';
import { isPassive } from './modelBound/passive.js';
import { getRemovedWithClassMetadata, getRemovedWithPropertyMetadata } from './modelBound/removedWith.js';
import { getRemovedWithJoinClassMetadata, getRemovedWithJoinPropertyMetadata } from './modelBound/removedWithJoin.js';
import { getVariantOfMetadata } from './modelBound/variantOf.js';
import { getEntersOnMetadata } from './modelBound/entersOn.js';
import { getGlobalForMetadata } from './modelBound/globalFor.js';
import { UnableToQueryProjection } from './UnableToQueryProjection.js';
import { BuiltProjection, crossWireGroups, mergeGlobalHandlers, reclassify, VariantDeclaration } from './VariantReclassifier.js';

interface ResolvedModelBoundMetadata {
    id: ProjectionId;
    eventSequenceId: string | undefined;
    readModelIdentifier: string;
}

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
        const readModelTypes = this._clientArtifacts.readModels;
        this._logger.debug('Discovering projections', { declarativeCount: declarativeTypes.length, readModelCount: readModelTypes.length });

        for (const type of declarativeTypes) {
            const metadata = getProjectionMetadata(type);
            if (metadata) {
                this._logger.debug('Discovered declarative projection', { projectionId: metadata.id.value, type: type.name });
                this._declarative.set(metadata.id.value, type);
            }
        }

        for (const type of readModelTypes) {
            if (!hasFromEventMetadata(type) && !hasModelBoundProperties(type)) {
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
        assertUniqueReadModelIds([...this._clientArtifacts.readModels, ...inferred]);
        const builtProjections: BuiltProjection[] = [
            ...Array.from(this._declarative.values()).map(type => this.buildDeclarativeDefinition(type)),
            ...Array.from(this._modelBound.values()).map(type => this.buildModelBoundDefinition(type))
        ];

        // Cross-wiring can only run once every variant in this registration call is known, so it
        // runs here rather than as each definition is built - and LastUpdated is computed only
        // afterward, so a RemovedWith entry it adds is reflected in the hash sent to the kernel.
        crossWireGroups(builtProjections);
        for (const built of builtProjections) {
            built.definition.LastUpdated = { Value: this.computeStableLastUpdated(built.definition) };
        }

        const projections = builtProjections.map(built => built.definition);

        if (projections.length === 0) {
            this._logger.info('No projections to register');
            return;
        }

        const readModels = this.buildReadModelDefinitions(projections);
        if (readModels.length > 0) {
            await this._connection.readModels.registerMany({
                EventStore: this._eventStore,
                Owner: 1,
                ReadModels: readModels,
                Source: 1
            });
        }

        for (const projection of projections) {
            const identifier = String((projection as { Identifier?: unknown }).Identifier ?? '<unknown>');
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

    private async registerWithRetry(projection: unknown, identifier: string, maxAttempts = 5): Promise<void> {
        let delay = 2000;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this._logger.info('Registering projection', { identifier, readModel: (projection as any).ReadModel, attempt });
                await this._connection.projections.register({
                    EventStore: this._eventStore,
                    Owner: ProjectionOwner.PROJECTION_OWNER_Client,
                    Projections: [projection as any]
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

    private buildReadModelDefinitions(projections: any[]): any[] {
        const byReadModel = new Map<string, any>();

        for (const projection of projections) {
            const readModelIdentifier = projection.ReadModel;
            if (!readModelIdentifier) {
                continue;
            }
            const existing = byReadModel.get(readModelIdentifier);
            if (existing) {
                if (existing.ObserverIdentifier !== projection.Identifier) {
                    throw new Error(`Read model id '${readModelIdentifier}' has multiple projections.`);
                }
                continue;
            }

            byReadModel.set(readModelIdentifier, {
                Type: {
                    Identifier: readModelIdentifier,
                    Generation: 1
                },
                ContainerName: readModelIdentifier,
                DisplayName: readModelIdentifier,
                Sink: {
                    ConfigurationId: toContractsGuid(Guid.empty),
                    // Passive projections never write to a materialized sink, so they register with
                    // the None sink. This lets the kernel fall through to immediate projection when
                    // resolving the instance by key instead of reading an empty sink and returning null.
                    TypeId: projection.IsActive === false ? WellKnownSinks.None : this._defaultSinkTypeId
                },
                Schema: this.getReadModelSchema(readModelIdentifier),
                Indexes: [],
                ObserverType: 2,
                ObserverIdentifier: projection.Identifier,
                Owner: 1,
                Source: 1
            });
        }

        return Array.from(byReadModel.values());
    }

    private getReadModelSchema(readModelIdentifier: string): string {
        const types = [
            ...this._clientArtifacts.readModels,
            ...this._clientArtifacts.projections
                .map(projectionType => getProjectionMetadata(projectionType)?.readModelType)
                .filter((type): type is Constructor => type !== undefined)
        ];
        for (const type of types) {
            const metadata = getReadModelMetadata(type);
            if (getReadModelId(type) === readModelIdentifier) {
                return JSON.stringify(metadata?.schema ?? JsonSchemaGenerator.generate(type));
            }
        }

        return '{}';
    }

    private buildDeclarativeDefinition(type: Constructor): BuiltProjection {
        const metadata = getProjectionMetadata(type);
        if (!metadata) {
            throw new Error(`Type '${type.name}' is missing declarative projection metadata.`);
        }

        const builder = new ProjectionBuilderFor<unknown>();
        const instance = new type() as IProjectionFor<unknown>;
        instance.define(builder);
        const definition = builder.build(metadata.id.value, type.name) as Record<string, unknown>;

        const explicitReadModelIdentifier = definition.ReadModel as string;
        if (explicitReadModelIdentifier === type.name) {
            // Use explicit readModelType from decorator if provided
            if (metadata.readModelType) {
                definition.ReadModel = getReadModelId(metadata.readModelType);
            } else {
                const inferredReadModelIdentifier = this.inferReadModelIdentifier(builder.getMappedReadModelProperties());
                if (inferredReadModelIdentifier) {
                    definition.ReadModel = inferredReadModelIdentifier;
                }
            }
        }

        let variant: VariantDeclaration | undefined;
        const variantDeclaration = builder.getVariantDeclaration();
        if (variantDeclaration) {
            const reclassified = reclassify(
                type.name,
                definition.From as any,
                definition.Join as any,
                variantDeclaration.enteringEventTypes,
                variantDeclaration.key);
            definition.From = reclassified.from;
            definition.Join = reclassified.join;
            variant = variantDeclaration;
        }

        return { typeName: type.name, definition, variant };
    }

    private inferReadModelIdentifier(mappedProperties: string[]): string | undefined {
        if (mappedProperties.length === 0) {
            return undefined;
        }

        const matchingReadModels = this._clientArtifacts.readModels
            .map(type => ({ type, metadata: getReadModelMetadata(type) }))
            .filter(candidate => candidate.metadata)
            .filter(candidate => {
                const readModelProperties = Array.from(candidate.metadata!.members.keys());
                return mappedProperties.every(property => readModelProperties.includes(property));
            });

        if (matchingReadModels.length !== 1) {
            return undefined;
        }

        return matchingReadModels[0].metadata!.id.value;
    }

    private buildModelBoundDefinition(type: Constructor): BuiltProjection {
        const metadata = this.resolveModelBoundMetadata(type);
        if (!metadata) {
            throw new Error(`Type '${type.name}' is missing model-bound projection metadata.`);
        }

        const properties = TypeIntrospector.getTrackedProperties(type);
        const prototype = type.prototype;

        const fromByEventType = new Map<string, FromRecord>();
        const joinByEventType = new Map<string, { Key: ContractEventType; Value: { On: string; Properties: Record<string, string>; Key: string } }>();
        const removedWithByEventType = new Map<string, { Key: ContractEventType; Value: { Key: string; ParentKey: string } }>();
        const removedWithJoinByEventType = new Map<string, { Key: ContractEventType; Value: { Key: string } }>();
        const childrenByProperty: Record<string, ChildrenDefinitionLike> = {};
        const nestedByProperty: Record<string, ChildrenDefinitionLike> = {};

        const fromEvents = getFromEventMetadata(type);
        for (const fromEvent of fromEvents) {
            const eventType = toContractEventType(fromEvent.eventType);
            const eventKey = getEventTypeMapKey(eventType);
            fromByEventType.set(eventKey, {
                Key: eventType,
                Value: {
                    Properties: {},
                    Key: fromEvent.constantKey ? constantValueExpression(fromEvent.constantKey) : (fromEvent.key ?? '$eventSourceId'),
                    ParentKey: fromEvent.parentKey ?? ''
                }
            });
        }

        const removedWithClass = getRemovedWithClassMetadata(type);
        for (const removed of removedWithClass) {
            const eventType = toContractEventType(removed.eventType);
            removedWithByEventType.set(getEventTypeMapKey(eventType), {
                Key: eventType,
                Value: { Key: removed.key ?? '$eventSourceId', ParentKey: removed.parentKey ?? '' }
            });
        }

        const removedWithJoinClass = getRemovedWithJoinClassMetadata(type);
        for (const removed of removedWithJoinClass) {
            const eventType = toContractEventType(removed.eventType);
            removedWithJoinByEventType.set(getEventTypeMapKey(eventType), {
                Key: eventType,
                Value: { Key: removed.key ?? '$eventSourceId' }
            });
        }

        for (const property of properties) {
            applyPropertyMappings(prototype, property, fromByEventType);

            for (const mapping of getJoinMetadata(prototype, property)) {
                const entry = this.ensureJoinEntry(joinByEventType, mapping.eventType);
                entry.Value.On = mapping.on ?? (entry.Value.On || property);
                entry.Value.Properties[property] = mapping.eventPropertyName ?? property;
            }

            for (const removed of getRemovedWithPropertyMetadata(prototype, property)) {
                const eventType = toContractEventType(removed.eventType);
                removedWithByEventType.set(getEventTypeMapKey(eventType), {
                    Key: eventType,
                    Value: { Key: removed.key ?? '$eventSourceId', ParentKey: removed.parentKey ?? '' }
                });
            }

            for (const removed of getRemovedWithJoinPropertyMetadata(prototype, property)) {
                const eventType = toContractEventType(removed.eventType);
                removedWithJoinByEventType.set(getEventTypeMapKey(eventType), {
                    Key: eventType,
                    Value: { Key: removed.key ?? '$eventSourceId' }
                });
            }

            const childrenFromList = getChildrenFromMetadata(prototype, property);
            if (childrenFromList.length > 0) {
                childrenByProperty[property] = buildChildrenEntry(type, property, childrenFromList);
            }

            const propertyIsNested = isNested(prototype, property);
            if (propertyIsNested) {
                nestedByProperty[property] = buildNestedEntry(type, property);
            }

            // A scalar (non-nested, non-children-collection) root property clears back to no value
            // every time the given event is observed. A nested single-object property's clearWith is
            // handled by buildNestedEntry instead, which clears the whole nested object.
            if (childrenFromList.length === 0 && !propertyIsNested) {
                for (const clearWith of getClearWithPropertyMetadata(prototype, property)) {
                    const entry = ensureFromEntry(fromByEventType, clearWith.eventType);
                    entry.Value.Properties[property] = '$null';
                }
            }
        }

        const allProperties: Record<string, string> = {};
        for (const property of properties) {
            const fromEvery = getFromEveryMetadata(prototype, property) ?? getFromAllMetadata(prototype, property);
            if (fromEvery) {
                allProperties[property] = fromEvery.contextProperty
                    ? fromEvery.contextProperty
                    : (fromEvery.property ?? property);
            }
        }

        let from = Array.from(fromByEventType.values());
        let join = Array.from(joinByEventType.values());
        let variant: VariantDeclaration | undefined;

        const variantMetadata = getVariantOfMetadata(type);
        if (variantMetadata) {
            const entersOnList = getEntersOnMetadata(type);
            const enteringEventTypes = entersOnList.map(entersOn => {
                const contractType = toContractEventType(entersOn.eventType);
                if (entersOn.key) {
                    const entry = ensureFromEntry(fromByEventType, entersOn.eventType);
                    entry.Value.Key = entersOn.key;
                }
                return contractType;
            });
            from = Array.from(fromByEventType.values());

            const globalHandlers = new Map<string, FromRecord[]>();
            for (const handlerType of this._clientArtifacts.globalForHandlers) {
                const globalForMetadata = getGlobalForMetadata(handlerType);
                if (globalForMetadata?.identity === variantMetadata.identity) {
                    globalHandlers.set(handlerType.name, this.buildFromRecordsForType(handlerType));
                }
            }

            const memberNames = new Set(getReadModelMetadata(type)?.members.keys() ?? TypeIntrospector.getMembers(type).keys());
            const merged = mergeGlobalHandlers(type.name, memberNames, from, globalHandlers);
            const reclassified = reclassify(type.name, merged, join, enteringEventTypes, variantMetadata.key);
            from = reclassified.from;
            join = reclassified.join;
            variant = { identity: variantMetadata.identity, key: variantMetadata.key, enteringEventTypes };
        }

        const definition: Record<string, unknown> = {
            EventSequenceId: metadata.eventSequenceId ?? EventSequenceId.eventLog.value,
            Identifier: metadata.id.value,
            ReadModel: metadata.readModelIdentifier,
            IsActive: !isPassive(type),
            IsRewindable: !isNotRewindable(type),
            InitialModelState: '{}',
            From: from,
            Join: join,
            Children: childrenByProperty,
            FromEvery: [],
            All: {
                Properties: allProperties,
                IncludeChildren: false,
                AutoMap: AutoMap.Inherit
            },
            RemovedWith: Array.from(removedWithByEventType.values()),
            RemovedWithJoin: Array.from(removedWithJoinByEventType.values()),
            LastUpdated: { Value: '' },
            Tags: [],
            AutoMap: isNoAutoMap(type) ? AutoMap.Disabled : AutoMap.Enabled,
            NoAutoMapProperties: properties.filter(property => isPropertyNoAutoMap(prototype, property)),
            Nested: nestedByProperty
        };
        return { typeName: type.name, definition, variant };
    }

    /**
     * Builds the raw From records for an arbitrary type using the same property-mapping rules as
     * a model-bound read model - used to fold a globalFor shared handler's mappings into every
     * variant of its identity.
     * @param type - The type to build From records for.
     * @returns The built From records.
     */
    private buildFromRecordsForType(type: Constructor): FromRecord[] {
        const fromByEventType = new Map<string, FromRecord>();
        const fromEvents = getFromEventMetadata(type);
        for (const fromEvent of fromEvents) {
            const eventType = toContractEventType(fromEvent.eventType);
            fromByEventType.set(getEventTypeMapKey(eventType), {
                Key: eventType,
                Value: {
                    Properties: {},
                    Key: fromEvent.constantKey ? constantValueExpression(fromEvent.constantKey) : (fromEvent.key ?? '$eventSourceId'),
                    ParentKey: fromEvent.parentKey ?? ''
                }
            });
        }

        const prototype = type.prototype;
        for (const property of TypeIntrospector.getTrackedProperties(type)) {
            applyPropertyMappings(prototype, property, fromByEventType);
        }

        return Array.from(fromByEventType.values());
    }

    private resolveModelBoundMetadata(type: Constructor): ResolvedModelBoundMetadata | undefined {
        if (hasFromEventMetadata(type) || hasModelBoundProperties(type)) {
            const identifier = getReadModelId(type);
            return {
                id: new ProjectionId(identifier),
                eventSequenceId: getEventSequenceMetadata(type),
                readModelIdentifier: identifier
            };
        }

        return undefined;
    }

    private ensureJoinEntry(
        joinByEventType: Map<string, { Key: ContractEventType; Value: { On: string; Properties: Record<string, string>; Key: string } }>,
        eventTypeConstructor: Function
    ): { Key: ContractEventType; Value: { On: string; Properties: Record<string, string>; Key: string } } {
        const eventType = toContractEventType(eventTypeConstructor);
        const key = getEventTypeMapKey(eventType);
        const existing = joinByEventType.get(key);
        if (existing) {
            return existing;
        }

        const created = {
            Key: eventType,
            Value: {
                On: '',
                Properties: {},
                Key: '$eventSourceId'
            }
        };
        joinByEventType.set(key, created);
        return created;
    }

    /**
     * Computes a stable, deterministic ISO timestamp from the projection definition content,
     * excluding the LastUpdated field itself. This ensures the server does not interpret
     * a repeated registration of an unchanged definition as a definition change, which
     * would otherwise trigger an unnecessary auto-replay.
     */
    private computeStableLastUpdated(definition: Record<string, unknown>): string {
        const { LastUpdated: _omit, ...rest } = definition;
        const content = JSON.stringify(rest, Object.keys(rest).sort());
        let hash = 5381;
        for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) + hash + content.charCodeAt(i)) >>> 0;
        }
        return new Date(hash * 1000).toISOString();
    }
}
