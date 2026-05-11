// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import {
    AutoMap,
    ProjectionOwner
} from '@cratis/chronicle.contracts';
import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { toContractsGuid } from '../connection/Guid';
import { EventSequenceId } from '../EventSequences/EventSequenceId';
import { getEventTypeFor } from '../Events/eventTypeDecorator';
import { getReadModelMetadata } from '../ReadModels';
import { WellKnownSinks } from '../sinks';
import { TypeIntrospector } from '../types';
import { IProjections } from './IProjections';
import { getProjectionMetadata } from './declarative/projection';
import { ProjectionBuilderFor } from './declarative/ProjectionBuilderFor';
import type { IProjectionFor } from './declarative/IProjectionFor';
import { getAddFromMetadata } from './modelBound/addFrom';
import { getChildrenFromMetadata } from './modelBound/childrenFrom';
import { getClearWithClassMetadata, getClearWithPropertyMetadata } from './modelBound/clearWith';
import { getCountMetadata } from './modelBound/count';
import { getDecrementMetadata } from './modelBound/decrement';
import { getFromEveryMetadata } from './modelBound/fromEvery';
import { getFromEventMetadata, hasFromEventMetadata } from './modelBound/fromEvent';
import { getIncrementMetadata } from './modelBound/increment';
import { getJoinMetadata } from './modelBound/join';
import { ProjectionId } from './ProjectionId';
import { isNested } from './modelBound/nested';
import { isNotRewindable } from './modelBound/notRewindable';
import { getRemovedWithClassMetadata, getRemovedWithPropertyMetadata } from './modelBound/removedWith';
import { getRemovedWithJoinClassMetadata, getRemovedWithJoinPropertyMetadata } from './modelBound/removedWithJoin';
import { getSetFromMetadata } from './modelBound/setFrom';
import { getSetFromContextMetadata } from './modelBound/setFromContext';
import { getSetValueMetadata } from './modelBound/setValue';
import { getSubtractFromMetadata } from './modelBound/subtractFrom';

type ContractEventType = { Id: string; Generation: number; Tombstone: boolean };

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

    private readonly _logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/Projections' });

    /**
     * Creates a new {@link Projections} instance.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {}

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
            if (!hasFromEventMetadata(type)) {
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

        const projections = [
            ...Array.from(this._declarative.values()).map(type => this.buildDeclarativeDefinition(type)),
            ...Array.from(this._modelBound.values()).map(type => this.buildModelBoundDefinition(type))
        ];

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
            if (!readModelIdentifier || byReadModel.has(readModelIdentifier)) {
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
                    ConfigurationId: toContractsGuid(WellKnownSinks.Null),
                    TypeId: toContractsGuid(WellKnownSinks.MongoDB)
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
        for (const type of this._clientArtifacts.readModels) {
            const metadata = getReadModelMetadata(type);
            if (!metadata) {
                continue;
            }

            if (metadata.id.value === readModelIdentifier || type.name === readModelIdentifier) {
                return JSON.stringify(metadata.schema);
            }
        }

        return '{}';
    }

    private buildDeclarativeDefinition(type: Constructor): any {
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
                const rm = getReadModelMetadata(metadata.readModelType);
                definition.ReadModel = rm?.id.value ?? (metadata.readModelType as Function).name;
            } else {
                const inferredReadModelIdentifier = this.inferReadModelIdentifier(builder.getMappedReadModelProperties());
                if (inferredReadModelIdentifier) {
                    definition.ReadModel = inferredReadModelIdentifier;
                }
            }
        }

        definition.LastUpdated = { Value: this.computeStableLastUpdated(definition) };
        return definition;
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

    private buildModelBoundDefinition(type: Constructor): any {
        const metadata = this.resolveModelBoundMetadata(type);
        if (!metadata) {
            throw new Error(`Type '${type.name}' is missing model-bound projection metadata.`);
        }

        const properties = TypeIntrospector.getTrackedProperties(type);
        const prototype = type.prototype;

        const fromByEventType = new Map<string, { Key: ContractEventType; Value: { Properties: Record<string, string>; Key: string; ParentKey: string } }>();
        const joinByEventType = new Map<string, { Key: ContractEventType; Value: { On: string; Properties: Record<string, string>; Key: string } }>();
        const removedWithByEventType = new Map<string, { Key: ContractEventType; Value: { Key: string; ParentKey: string } }>();
        const removedWithJoinByEventType = new Map<string, { Key: ContractEventType; Value: { Key: string } }>();

        const fromEvents = getFromEventMetadata(type);
        for (const fromEvent of fromEvents) {
            const eventType = this.toContractEventType(fromEvent.eventType);
            const eventKey = this.getEventTypeMapKey(eventType);
            fromByEventType.set(eventKey, {
                Key: eventType,
                Value: {
                    Properties: {},
                    Key: fromEvent.constantKey ?? fromEvent.key ?? '$eventSourceId',
                    ParentKey: fromEvent.parentKey ?? ''
                }
            });
        }

        const clearWithClass = getClearWithClassMetadata(type);
        if (clearWithClass.length > 0) {
            throw new Error(`Model-bound projection '${type.name}' uses @clearWith on class level, which is not implemented yet.`);
        }

        const removedWithClass = getRemovedWithClassMetadata(type);
        for (const removed of removedWithClass) {
            const eventType = this.toContractEventType(removed.eventType);
            removedWithByEventType.set(this.getEventTypeMapKey(eventType), {
                Key: eventType,
                Value: { Key: removed.key ?? '$eventSourceId', ParentKey: removed.parentKey ?? '' }
            });
        }

        const removedWithJoinClass = getRemovedWithJoinClassMetadata(type);
        for (const removed of removedWithJoinClass) {
            const eventType = this.toContractEventType(removed.eventType);
            removedWithJoinByEventType.set(this.getEventTypeMapKey(eventType), {
                Key: eventType,
                Value: { Key: removed.key ?? '$eventSourceId' }
            });
        }

        for (const property of properties) {
            this.throwIfUnsupportedModelBoundDecorators(type.name, prototype, property);

            for (const mapping of getSetFromMetadata(prototype, property)) {
                const entry = this.ensureFromEntry(fromByEventType, mapping.eventType);
                entry.Value.Properties[property] = mapping.eventPropertyName ?? property;
            }

            for (const mapping of getSetFromContextMetadata(prototype, property)) {
                const entry = this.ensureFromEntry(fromByEventType, mapping.eventType);
                entry.Value.Properties[property] = mapping.contextPropertyName ?? property;
            }

            for (const mapping of getSetValueMetadata(prototype, property)) {
                const entry = this.ensureFromEntry(fromByEventType, mapping.eventType);
                entry.Value.Properties[property] = JSON.stringify(mapping.value);
            }

            for (const mapping of getJoinMetadata(prototype, property)) {
                const entry = this.ensureJoinEntry(joinByEventType, mapping.eventType);
                entry.Value.On = mapping.on ?? entry.Value.On;
                entry.Value.Properties[property] = mapping.eventPropertyName ?? property;
            }

            const fromEvery = getFromEveryMetadata(prototype, property);
            if (fromEvery) {
                // Applied later to projection.All
            }

            for (const removed of getRemovedWithPropertyMetadata(prototype, property)) {
                const eventType = this.toContractEventType(removed.eventType);
                removedWithByEventType.set(this.getEventTypeMapKey(eventType), {
                    Key: eventType,
                    Value: { Key: removed.key ?? '$eventSourceId', ParentKey: removed.parentKey ?? '' }
                });
            }

            for (const removed of getRemovedWithJoinPropertyMetadata(prototype, property)) {
                const eventType = this.toContractEventType(removed.eventType);
                removedWithJoinByEventType.set(this.getEventTypeMapKey(eventType), {
                    Key: eventType,
                    Value: { Key: removed.key ?? '$eventSourceId' }
                });
            }
        }

        const allProperties: Record<string, string> = {};
        for (const property of properties) {
            const fromEvery = getFromEveryMetadata(prototype, property);
            if (fromEvery) {
                allProperties[property] = fromEvery.contextProperty
                    ? fromEvery.contextProperty
                    : (fromEvery.property ?? property);
            }
        }

        const definition: Record<string, unknown> = {
            EventSequenceId: metadata.eventSequenceId ?? EventSequenceId.eventLog.value,
            Identifier: metadata.id.value,
            ReadModel: metadata.readModelIdentifier,
            IsActive: true,
            IsRewindable: !isNotRewindable(type),
            InitialModelState: '{}',
            From: Array.from(fromByEventType.values()),
            Join: Array.from(joinByEventType.values()),
            Children: {},
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
            AutoMap: AutoMap.Enabled,
            Nested: {}
        };
        definition.LastUpdated = { Value: this.computeStableLastUpdated(definition) };
        return definition;
    }

    private resolveModelBoundMetadata(type: Constructor): ResolvedModelBoundMetadata | undefined {
        const readModelMetadata = getReadModelMetadata(type);

        if (readModelMetadata && hasFromEventMetadata(type)) {
            return {
                id: new ProjectionId(readModelMetadata.id.value),
                eventSequenceId: undefined,
                readModelIdentifier: readModelMetadata.id.value
            };
        }

        return undefined;
    }

    private throwIfUnsupportedModelBoundDecorators(typeName: string, prototype: object, property: string): void {
        if (getAddFromMetadata(prototype, property).length > 0) {
            throw new Error(`Model-bound projection '${typeName}' uses @addFrom on '${property}', which is not implemented yet.`);
        }
        if (getSubtractFromMetadata(prototype, property).length > 0) {
            throw new Error(`Model-bound projection '${typeName}' uses @subtractFrom on '${property}', which is not implemented yet.`);
        }
        if (getIncrementMetadata(prototype, property).length > 0) {
            throw new Error(`Model-bound projection '${typeName}' uses @increment on '${property}', which is not implemented yet.`);
        }
        if (getDecrementMetadata(prototype, property).length > 0) {
            throw new Error(`Model-bound projection '${typeName}' uses @decrement on '${property}', which is not implemented yet.`);
        }
        if (getCountMetadata(prototype, property).length > 0) {
            throw new Error(`Model-bound projection '${typeName}' uses @count on '${property}', which is not implemented yet.`);
        }
        if (getChildrenFromMetadata(prototype, property).length > 0) {
            throw new Error(`Model-bound projection '${typeName}' uses @childrenFrom on '${property}', which is not implemented yet.`);
        }
        if (isNested(prototype, property)) {
            throw new Error(`Model-bound projection '${typeName}' uses @nested on '${property}', which is not implemented yet.`);
        }
        if (getClearWithPropertyMetadata(prototype, property).length > 0) {
            throw new Error(`Model-bound projection '${typeName}' uses @clearWith on '${property}', which is not implemented yet.`);
        }
    }

    private ensureFromEntry(
        fromByEventType: Map<string, { Key: ContractEventType; Value: { Properties: Record<string, string>; Key: string; ParentKey: string } }>,
        eventTypeConstructor: Function
    ): { Key: ContractEventType; Value: { Properties: Record<string, string>; Key: string; ParentKey: string } } {
        const eventType = this.toContractEventType(eventTypeConstructor);
        const key = this.getEventTypeMapKey(eventType);
        const existing = fromByEventType.get(key);
        if (existing) {
            return existing;
        }

        const created = {
            Key: eventType,
            Value: {
                Properties: {},
                Key: '$eventSourceId',
                ParentKey: ''
            }
        };
        fromByEventType.set(key, created);
        return created;
    }

    private ensureJoinEntry(
        joinByEventType: Map<string, { Key: ContractEventType; Value: { On: string; Properties: Record<string, string>; Key: string } }>,
        eventTypeConstructor: Function
    ): { Key: ContractEventType; Value: { On: string; Properties: Record<string, string>; Key: string } } {
        const eventType = this.toContractEventType(eventTypeConstructor);
        const key = this.getEventTypeMapKey(eventType);
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

    private toContractEventType(eventTypeConstructor: Function): ContractEventType {
        const eventType = getEventTypeFor(eventTypeConstructor);
        if (eventType.id.value === '') {
            throw new Error(`Event type '${eventTypeConstructor.name}' is not decorated with @eventType().`);
        }
        return {
            Id: eventType.id.value,
            Generation: eventType.generation.value,
            Tombstone: false
        };
    }

    private getEventTypeMapKey(eventType: ContractEventType): string {
        return `${eventType.Id}:${eventType.Generation}:${eventType.Tombstone ? '1' : '0'}`;
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
