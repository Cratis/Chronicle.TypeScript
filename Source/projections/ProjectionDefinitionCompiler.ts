// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, ReadModelObserverType, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { getReadModelMetadata } from '../readModels/index.js';
import { getReadModelId } from '../readModels/readModel.js';
import { buildReadModelDefinition } from '../readModels/buildReadModelDefinition.js';
import { rootReadModelTypes } from '../readModels/rootReadModelTypes.js';
import { JsonSchemaGenerator } from '../schemas/index.js';
import { WellKnownSinks } from '../sinks/index.js';
import { TypeIntrospector } from '../types/index.js';
import { canonicalStringify } from './canonicalStringify.js';
import { CompiledProjectionDefinitions } from './CompiledProjectionDefinitions.js';
import { constantValueExpression } from './constantValueExpression.js';
import { eventContextPropertyExpression, InvalidEventContextPropertyError } from './eventContextPropertyExpression.js';
import { getProjectionMetadata } from './declarative/projection.js';
import { ProjectionBuilderFor } from './declarative/ProjectionBuilderFor.js';
import type { IProjectionFor } from './declarative/IProjectionFor.js';
import {
    applyPropertyMappings, buildChildrenEntry, buildNestedEntry, ChildrenDefinitionLike,
    ContractEventType, ensureFromEntry, FromRecord, getEventTypeMapKey, toContractEventType
} from './modelBound/childrenAndNestedBuilder.js';
import { getChildrenFromMetadata } from './modelBound/childrenFrom.js';
import { getClearWithPropertyMetadata } from './modelBound/clearWith.js';
import { getEventSequenceMetadata } from './modelBound/eventSequence.js';
import { getFromAllMetadata } from './modelBound/fromAll.js';
import { getFromEveryMetadata } from './modelBound/fromEvery.js';
import { getFromEventMetadata } from './modelBound/fromEvent.js';
import { isModelBoundProjection } from './modelBound/isModelBoundProjection.js';
import { getJoinMetadata } from './modelBound/join.js';
import { isNoAutoMap, isPropertyNoAutoMap } from './modelBound/noAutoMap.js';
import { isNested } from './modelBound/nested.js';
import { isNotRewindable } from './modelBound/notRewindable.js';
import { isPassive } from './modelBound/passive.js';
import { getRemovedWithClassMetadata, getRemovedWithPropertyMetadata } from './modelBound/removedWith.js';
import { getRemovedWithJoinClassMetadata, getRemovedWithJoinPropertyMetadata } from './modelBound/removedWithJoin.js';
import { getVariantOfMetadata } from './modelBound/variantOf.js';
import { getEntersOnMetadata } from './modelBound/entersOn.js';
import { getGlobalForMetadata } from './modelBound/globalFor.js';
import type { JoinRecord } from './declarative/ProjectionBuilderCore.js';
import { BuiltProjection, crossWireGroups, mergeGlobalHandlers, reclassify, VariantDeclaration } from './VariantReclassifier.js';

/** Compiles discovered projection types into the contracts sent to the kernel, without a connection. */
export class ProjectionDefinitionCompiler {
    /**
     * @param _clientArtifacts - Discovered artifact types used to resolve schemas, variants, and read models.
     * @param _defaultSinkTypeId - Sink identifier for active read models.
     */
    constructor(
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _defaultSinkTypeId: string
    ) {}

    /**
     * Builds all definitions together so variant cross-wiring precedes the final hash.
     * @param declarative - Discovered declarative projection types.
     * @param modelBound - Discovered model-bound read model types.
     * @returns Projection definitions and read-model registrations ready for the wire.
     */
    compile(declarative: Iterable<Constructor>, modelBound: Iterable<Constructor>): CompiledProjectionDefinitions {
        const builtProjections: BuiltProjection[] = [
            ...Array.from(declarative, type => this.buildWithContextValidation(type, () => this.buildDeclarativeDefinition(type),
                getProjectionMetadata(type)?.readModelType)),
            ...Array.from(modelBound, type => this.buildWithContextValidation(type, () => this.buildModelBoundDefinition(type), type))
        ];
        // A sibling's entering event adds RemovedWith to each variant. Hash only after
        // every variant has been cross-wired, so repeated registrations remain stable.
        crossWireGroups(builtProjections);
        for (const built of builtProjections) {
            built.definition.LastUpdated = { Value: this.computeStableLastUpdated(built.definition) };
        }

        // The generated contract includes fields initialized by the transport encoder. Keep the
        // existing sparse wire objects: adding those default-valued fields would change the payload.
        // Evaluators must tolerate absent optional contract fields (for example NoAutoMapProperties).
        const definitions = builtProjections.map(built => built.definition as unknown as ProjectionDefinition);
        return {
            definitions,
            readModels: this.buildReadModelDefinitions(definitions)
        };
    }

    private buildWithContextValidation(type: Constructor, build: () => BuiltProjection, readModelType?: Constructor): BuiltProjection {
        try {
            return build();
        } catch (error) {
            if (error instanceof InvalidEventContextPropertyError) {
                const readModel = readModelType ? getReadModelId(readModelType) : type.name;
                throw new Error(`Invalid event context property '${error.propertyPath}' in projection '${type.name}' (read model '${readModel}').`, { cause: error });
            }
            throw error;
        }
    }

    private buildReadModelDefinitions(projections: ProjectionDefinition[]): ReturnType<typeof buildReadModelDefinition>[] {
        const byReadModel = new Map<string, ReturnType<typeof buildReadModelDefinition>>();
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
            const readModelType = this.getReadModelType(readModelIdentifier);
            byReadModel.set(readModelIdentifier, buildReadModelDefinition({
                identifier: readModelIdentifier,
                type: readModelType,
                schema: readModelType
                    ? JSON.stringify(getReadModelMetadata(readModelType)?.schema ?? JsonSchemaGenerator.generate(readModelType))
                    : '{}',
                // Passive projections never write to a materialized sink, so they register with
                // the None sink. This lets the kernel fall through to immediate projection when
                // resolving the instance by key instead of reading an empty sink and returning null.
                sinkTypeId: projection.IsActive === false ? WellKnownSinks.None : this._defaultSinkTypeId,
                observerType: ReadModelObserverType.Projection,
                observerIdentifier: projection.Identifier
            }));
        }
        return Array.from(byReadModel.values());
    }

    private getReadModelType(readModelIdentifier: string): Constructor | undefined {
        const types = [
            ...rootReadModelTypes(this._clientArtifacts),
            ...this._clientArtifacts.projections
                .map(projectionType => getProjectionMetadata(projectionType)?.readModelType)
                .filter((type): type is Constructor => type !== undefined)
        ];
        for (const type of types) {
            if (getReadModelId(type) === readModelIdentifier) return type;
        }
        return undefined;
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
                type.name, definition.From as FromRecord[], definition.Join as JoinRecord[],
                variantDeclaration.enteringEventTypes, variantDeclaration.key);
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
        const matchingReadModels = rootReadModelTypes(this._clientArtifacts)
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
        if (!isModelBoundProjection(type)) {
            throw new Error(`Type '${type.name}' is missing model-bound projection metadata.`);
        }
        const readModelIdentifier = getReadModelId(type);
        const eventSequenceId = getEventSequenceMetadata(type);
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
            // A scalar root property clears back to no value when the given event is observed.
            // Nested single-object clearWith is handled by buildNestedEntry instead.
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
                    ? eventContextPropertyExpression(fromEvery.contextProperty)
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
            EventSequenceId: eventSequenceId ?? EventSequenceId.eventLog.value,
            Identifier: readModelIdentifier,
            ReadModel: readModelIdentifier,
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
     * Builds event mappings for a global variant handler without creating a separate projection.
     * @param type - The global handler type containing from-event and property mappings.
     * @returns The event mappings to merge into each matching variant.
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
        const created = { Key: eventType, Value: { On: '', Properties: {}, Key: '$eventSourceId' } };
        joinByEventType.set(key, created);
        return created;
    }

    /** Hash the final wire definition, excluding LastUpdated itself, for stable metadata. */
    private computeStableLastUpdated(definition: Record<string, unknown>): string {
        const { LastUpdated: _omit, ...rest } = definition;
        const content = canonicalStringify(rest);
        let hash = 5381;
        for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) + hash + content.charCodeAt(i)) >>> 0;
        }
        return new Date(hash * 1000).toISOString();
    }
}
