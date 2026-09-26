// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, ReadModelObserverType, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { getEventTypeFor, getEventTypeJsonSchemaFor } from '../events/eventTypeDecorator.js';
import { getReadModelMetadata } from '../readModels/index.js';
import { getReadModelId } from '../readModels/readModel.js';
import { buildReadModelDefinition } from '../readModels/buildReadModelDefinition.js';
import { rootReadModelTypes } from '../readModels/rootReadModelTypes.js';
import { JsonSchemaGenerator } from '../schemas/index.js';
import { WellKnownSinks } from '../sinks/index.js';
import { TypeIntrospector } from '../types/index.js';
import { CompiledProjectionDefinitions } from './CompiledProjectionDefinitions.js';
import { captureProjectionProvenance } from './captureProjectionProvenance.js';
import { eventContractPath } from './eventContractPath.js';
import { getProjectionBuilderProvenance } from './declarative/projectionBuilderProvenance.js';
import type { ProjectionCapabilityProvenance } from './ProjectionCapabilityProvenance.js';
import type { ProjectionEventSchema } from './ProjectionEventSchema.js';
import { constantValueExpression } from './constantValueExpression.js';
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
import { getSetFromMetadata } from './modelBound/setFrom.js';
import { getSetFromContextMetadata } from './modelBound/setFromContext.js';
import { getSetValueMetadata } from './modelBound/setValue.js';
import { getAddFromMetadata } from './modelBound/addFrom.js';
import { getSubtractFromMetadata } from './modelBound/subtractFrom.js';
import { getCountMetadata } from './modelBound/count.js';
import { getIncrementMetadata } from './modelBound/increment.js';
import { getDecrementMetadata } from './modelBound/decrement.js';
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
            ...Array.from(declarative, type => this.buildDeclarativeDefinition(type)),
            ...Array.from(modelBound, type => this.buildModelBoundDefinition(type))
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
        const provenance = new Map<ProjectionDefinition, readonly ProjectionCapabilityProvenance[]>();
        const eventSchemas = new Map<ProjectionDefinition, ReadonlyMap<string, ProjectionEventSchema>>();
        const availableEvents = new Map<string, Constructor>(this._clientArtifacts.eventTypes.map(type => {
            const event = getEventTypeFor(type);
            return [`${event.id.value}:${event.generation.value}`, type] as const;
        }));
        for (let index = 0; index < definitions.length; index++) {
            provenance.set(definitions[index], builtProjections[index].provenance ?? []);
            eventSchemas.set(definitions[index], this.buildEventSchemaCatalog(definitions[index], availableEvents));
        }
        return {
            definitions,
            readModels: this.buildReadModelDefinitions(definitions),
            provenance,
            eventSchemas
        };
    }

    private buildEventSchemaCatalog(definition: ProjectionDefinition, availableEvents: ReadonlyMap<string, Constructor>): ReadonlyMap<string, ProjectionEventSchema> {
        const catalog = new Map<string, ProjectionEventSchema>();
        const collect = (node: Record<string, unknown>) => {
            for (const section of ['From', 'Join', 'RemovedWith', 'RemovedWithJoin'] as const) {
                for (const entry of node[section] as Array<{ Key: ContractEventType }> ?? []) {
                    const eventType = entry.Key;
                    const key = getEventTypeMapKey(eventType);
                    const type = availableEvents.get(`${eventType.Id}:${eventType.Generation}`);
                    if (type && !catalog.has(key)) {
                        // Registration uses this exact schema path. Clone it so a compile or consumer
                        // cannot mutate metadata or another compile's catalog.
                        catalog.set(key, { eventType: { ...eventType }, schema: structuredClone(getEventTypeJsonSchemaFor(type)) });
                    }
                }
            }
            const fromEventProperty = node.FromEventProperty as { Event?: ContractEventType } | undefined;
            if (fromEventProperty?.Event) {
                const key = getEventTypeMapKey(fromEventProperty.Event);
                const type = availableEvents.get(`${fromEventProperty.Event.Id}:${fromEventProperty.Event.Generation}`);
                if (type && !catalog.has(key)) catalog.set(key, { eventType: { ...fromEventProperty.Event }, schema: structuredClone(getEventTypeJsonSchemaFor(type)) });
            }
            for (const section of ['Children', 'Nested'] as const) {
                for (const child of Object.values(node[section] as Record<string, Record<string, unknown>> ?? {})) collect(child);
            }
        };
        collect(definition as unknown as Record<string, unknown>);
        return catalog;
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

        const declarations = getProjectionBuilderProvenance(builder);
        const provenance = captureProjectionProvenance(definition, false,
            new Map([...declarations.keys, ...declarations.children]));
        if (declarations.fromEvery && !provenance.some(entry => entry.contractPath === 'All')) {
            provenance.push({ contractPath: 'All', declaration: '.fromEvery' });
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
            provenance.push({ contractPath: 'Variant', declaration: '.variantOf' });
            provenance.push({ contractPath: 'Variant.Key', declaration: '.variantOf' });
            for (const entering of variant.enteringEventTypes) provenance.push({ contractPath: eventContractPath('EntersOn', entering), declaration: '.entersOn' });
        }
        return { typeName: type.name, definition, variant, provenance };
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
        const overrides = new Map<string, string>();
        const declaredFrom = new Set(getFromEventMetadata(type).map(entry => getEventTypeMapKey(toContractEventType(entry.eventType))));
        const recordMappings = (property: string, metadata: Array<{ eventType: Function }>, declaration: string) => {
            for (const mapping of metadata) {
                const eventType = toContractEventType(mapping.eventType);
                const path = eventContractPath('From', eventType);
                overrides.set(`${path}.Properties.${property}`, declaration);
                if (!declaredFrom.has(getEventTypeMapKey(eventType)) && !overrides.has(path)) overrides.set(path, declaration);
            }
        };

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
            recordMappings(property, getSetFromMetadata(prototype, property), '@setFrom');
            recordMappings(property, getSetFromContextMetadata(prototype, property), '@setFromContext');
            recordMappings(property, getSetValueMetadata(prototype, property), '@setValue');
            recordMappings(property, getAddFromMetadata(prototype, property), '@addFrom');
            recordMappings(property, getSubtractFromMetadata(prototype, property), '@subtractFrom');
            recordMappings(property, getIncrementMetadata(prototype, property), '@increment');
            recordMappings(property, getDecrementMetadata(prototype, property), '@decrement');
            recordMappings(property, getCountMetadata(prototype, property), '@count');
            for (const [declaration, mappings] of [
                ['@increment', getIncrementMetadata(prototype, property)],
                ['@decrement', getDecrementMetadata(prototype, property)],
                ['@count', getCountMetadata(prototype, property)]
            ] as const) {
                for (const mapping of mappings) {
                    if (mapping.constantKey) overrides.set(`${eventContractPath('From', toContractEventType(mapping.eventType))}.Key`, declaration);
                }
            }
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
                    overrides.set(`${eventContractPath('From', toContractEventType(clearWith.eventType))}.Properties.${property}`, '@clearWith');
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
        let preLoweringFrom = from;
        let preLoweringJoin = join;
        let variant: VariantDeclaration | undefined;
        const variantMetadata = getVariantOfMetadata(type);
        if (variantMetadata) {
            const entersOnList = getEntersOnMetadata(type);
            const enteringEventTypes = entersOnList.map(entersOn => {
                const contractType = toContractEventType(entersOn.eventType);
                if (entersOn.key) {
                    const entry = ensureFromEntry(fromByEventType, entersOn.eventType);
                    entry.Value.Key = entersOn.key;
                    overrides.set(`${eventContractPath('From', contractType)}.Key`, '@entersOn');
                }
                return contractType;
            });
            from = Array.from(fromByEventType.values());
            const globalHandlers = new Map<string, FromRecord[]>();
            for (const handlerType of this._clientArtifacts.globalForHandlers) {
                const globalForMetadata = getGlobalForMetadata(handlerType);
                if (globalForMetadata?.identity === variantMetadata.identity) {
                    const records = this.buildFromRecordsForType(handlerType);
                    globalHandlers.set(handlerType.name, records);
                    for (const record of records) {
                        const path = eventContractPath('From', record.Key);
                        overrides.set(path, `@globalFor(${handlerType.name})`);
                        for (const property of Object.keys(record.Value.Properties)) {
                            overrides.set(`${path}.Properties.${property}`, `@globalFor(${handlerType.name})`);
                        }
                    }
                }
            }
            const memberNames = new Set(getReadModelMetadata(type)?.members.keys() ?? TypeIntrospector.getMembers(type).keys());
            const merged = mergeGlobalHandlers(type.name, memberNames, from, globalHandlers);
            preLoweringFrom = merged;
            preLoweringJoin = join;
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
        const provenance = captureProjectionProvenance({ ...definition, From: preLoweringFrom, Join: preLoweringJoin }, true, overrides);
        if (Object.keys(allProperties).length && Object.keys(allProperties).every(property =>
            getFromAllMetadata(prototype, property) && !getFromEveryMetadata(prototype, property))) {
            const index = provenance.findIndex(entry => entry.contractPath === 'All');
            if (index >= 0) provenance[index] = { contractPath: 'All', declaration: '@fromAll' };
        }
        for (const property of Object.keys(allProperties)) {
            if (getFromAllMetadata(prototype, property) && !getFromEveryMetadata(prototype, property)) {
                const path = `All.Properties.${property}`;
                const index = provenance.findIndex(entry => entry.contractPath === path);
                if (index >= 0) provenance[index] = { contractPath: path, declaration: '@fromAll' };
            }
        }
        if (variant) {
            provenance.push({ contractPath: 'Variant', declaration: '@variantOf' });
            provenance.push({ contractPath: 'Variant.Key', declaration: '@variantOf' });
            for (const entering of variant.enteringEventTypes) provenance.push({ contractPath: eventContractPath('EntersOn', entering), declaration: '@entersOn' });
        }
        return { typeName: type.name, definition, variant, provenance };
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

    /** Hash the final wire definition, excluding LastUpdated itself, to avoid unnecessary replays. */
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
