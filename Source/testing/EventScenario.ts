// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { TypeIntrospector } from '../types/TypeIntrospector.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { AppendResult } from '../eventSequences/AppendResult.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { IEventSequence } from '../eventSequences/IEventSequence.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { getEventTypeFor, getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { compileConstraints } from '../events/constraints/Constraints.js';
import type { UniqueConstraintCapture } from '../events/constraints/UniqueConstraintBuilder.js';
import type { ConstraintCapture } from '../events/constraints/ConstraintBuilder.js';
import { getUniqueEventMetadata, getUniquePropertyMetadata } from '../events/constraints/unique.js';
import { getRemovedConstraintNames } from '../events/constraints/removeConstraint.js';
import { getConstraintMetadata } from '../events/constraints/constraint.js';
import { InProcessConstraints } from './InProcessConstraints.js';
import { supportsPropertyOverlap } from './PropertyDefinitionSupport.js';
import { supportsMeasuredKeySchema } from './MeasuredConstraintKeys.js';
import type { EventScenarioOptions } from './EventScenarioOptions.js';
import { EventScenarioGivenBuilder } from './EventScenarioGivenBuilder.js';
import { EventScenarioWhenBuilder } from './EventScenarioWhenBuilder.js';
import { InProcessEventSequence } from './InProcessEventSequence.js';
import { registerScenarioSeed } from './EventScenarioSeed.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

function hasPlainScalarSchemas(schemas: ReadonlyArray<{ type?: string; format?: string } | undefined>): boolean {
    return schemas.every(schema => ['string', 'boolean'].includes(schema?.type ?? '') && schema?.format === undefined);
}

function hasCombinedKeySchemas(schemas: ReadonlyArray<{ type?: string; format?: string } | undefined>): boolean {
    return schemas.every(schema => schema?.type === 'string' && (schema.format === undefined || schema.format === 'guid') ||
        schema?.type === 'number' && schema.format === undefined);
}

function isGuidOrNumericKey(schema: { type?: string; format?: string } | undefined): boolean {
    return schema?.format === 'guid' || schema?.type === 'number';
}

function validateExtendedDefinition(name: string, unique: UniqueConstraintCapture | undefined,
    constructors: ReadonlyMap<string, Function>): void {
    if (!unique) return;
    const schemas = unique.eventDefinitions.flatMap(entry => propertySchemas(entry, constructors));
    if (!schemas.some(isGuidOrNumericKey)) return;
    if (schemas.some(schema => schema?.type === 'boolean')) {
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
            'Boolean keys mixed with Guid or numeric keys in one definition are not fixture-backed.');
    }
    const removers = [unique.removedWithEventTypeId, ...(unique.removedWithEventTypeIds ?? [])].filter(id => id !== undefined);
    if (unique.eventDefinitions.some(entry => removers.includes(entry.eventTypeId))) {
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
            'Guid and numeric keys with covered-and-removal events are not fixture-backed.');
    }
    if (hasUnsupportedFieldlessRemoval(unique, constructors, removers)) {
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
            'Guid and numeric keys with fieldless removal events are not fixture-backed.');
    }
}

function validateKeySchemas(name: string, schemas: ReadonlyArray<{ type?: string; format?: string } | undefined>,
    options: { scoped: boolean; isolated: boolean; definitions: number; ignoreCasing: boolean }): void {
    const fail = (reason: string) => { throw new UnsupportedEventSequenceOperation('artifacts.constraints', name, reason); };
    if (options.scoped && !hasSupportedScopeSchemas(schemas)) {
        fail('Scoped property keys must be schema-backed strings, booleans, Guids or unformatted numbers.');
    }
    validateIndividualKeySchemas(name, schemas, options);
    if (schemas.some(isGuidOrNumericKey) && !supportsGuidNumericDefinition(schemas, options)) {
        fail('Guid and numeric keys require one definition; combined keys require unformatted numbers or Guids.');
    }
    if (options.ignoreCasing && !hasPlainStringSchemas(schemas)) fail('Case-insensitive keys must be schema-backed strings.');
    if (schemas.length > 1 && !hasCombinedKeySchemas(schemas)) {
        fail('Every property of a composite key must be a schema-backed string, Guid or unformatted number.');
    }
}

function propertySchemas(entry: UniqueConstraintCapture['eventDefinitions'][number], constructors: ReadonlyMap<string, Function>) {
    return entry.properties.map(property => getEventTypeMetadata(constructors.get(entry.eventTypeId)!)?.schema.properties?.[property]);
}

function validateIndividualKeySchemas(name: string, schemas: ReadonlyArray<{ type?: string; format?: string } | undefined>,
    options: { scoped: boolean; isolated: boolean; definitions: number; ignoreCasing: boolean }): void {
    for (const schema of schemas) {
        if (!supportsMeasuredKeySchema(schema, options, schemas.length)) {
            throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                `Unique keys with schema ${schema?.type ?? 'missing'}/${schema?.format ?? 'unformatted'} are not fixture-backed; date, object and other numeric formats require a kernel-backed test.`);
        }
    }
}

function hasSupportedScopeSchemas(schemas: ReadonlyArray<{ type?: string; format?: string } | undefined>): boolean {
    return hasPlainScalarSchemas(schemas) || hasCombinedKeySchemas(schemas);
}

function supportsGuidNumericDefinition(schemas: ReadonlyArray<{ type?: string; format?: string } | undefined>,
    options: { definitions: number; isolated: boolean }): boolean {
    return options.definitions === 1 && (options.isolated || hasCombinedKeySchemas(schemas));
}

function hasPlainStringSchemas(schemas: ReadonlyArray<{ type?: string; format?: string } | undefined>): boolean {
    return schemas.every(schema => schema?.type === 'string' && schema.format === undefined);
}

function supportsFieldlessPropertyRemoval(unique: UniqueConstraintCapture | undefined, constructors: ReadonlyMap<string, Function>): boolean {
    return !!unique && !unique.ignoreCasing && unique.eventDefinitions.every(entry => supportsFieldlessProperty(entry, constructors));
}

function supportsFieldlessProperty(entry: UniqueConstraintCapture['eventDefinitions'][number], constructors: ReadonlyMap<string, Function>): boolean {
    if (entry.properties.length !== 1) return false;
    const field = propertySchemas(entry, constructors)[0];
    return field?.type === 'string' || field?.type === 'number';
}

function hasUnsupportedFieldlessRemoval(unique: UniqueConstraintCapture | undefined, constructors: ReadonlyMap<string, Function>,
    removedWith: readonly (string | undefined)[]): boolean {
    return !supportsFieldlessPropertyRemoval(unique, constructors) && removedWith.some(id => isFieldless(id, constructors));
}

function isFieldless(id: string | undefined, constructors: ReadonlyMap<string, Function>): boolean {
    const type = id === undefined ? undefined : constructors.get(id);
    return type !== undefined && Object.keys(getEventTypeMetadata(type)?.schema.properties ?? {}).length === 0;
}

function constraintReferences(capture: ConstraintCapture): { ids: (string | undefined)[]; removedWith: (string | undefined)[] } {
    return {
        ids: capture.uniqueConstraint?.eventDefinitions.map(entry => entry.eventTypeId) ??
            capture.uniqueEventType?.eventTypeIds ?? [capture.uniqueEventType?.eventTypeId],
        removedWith: [...(capture.uniqueConstraint?.removedWithEventTypeIds ?? []),
            capture.uniqueConstraint?.removedWithEventTypeId, ...(capture.uniqueEventType?.removedWithEventTypeIds ?? [])]
    };
}

function validateScenarioDefinition(name: string, capture: ConstraintCapture,
    options: { selectedIds: ReadonlySet<string>; constructors: ReadonlyMap<string, Function>; definitions: number }): void {
    const { selectedIds, constructors, definitions } = options;
    const { ids, removedWith } = constraintReferences(capture);
    if (hasUnselectedReferences([...ids, ...removedWith], selectedIds)) {
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
            'Every constrained event type must be in the selected catalog. Claiming and removal references must be complete.');
    }
    const scoped = Object.values(capture.scope).some(Boolean);
    if (scoped && hasUnsupportedFieldlessRemoval(capture.uniqueConstraint, constructors, removedWith)) {
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
            'Scoped fieldless removers require a case-sensitive single-property unique constraint with string, Guid or numeric keys; other combinations are not fixture-backed.');
    }
    validateExtendedDefinition(name, capture.uniqueConstraint, constructors);
    for (const entry of capture.uniqueConstraint?.eventDefinitions ?? []) {
        const schemas = propertySchemas(entry, constructors);
        validateKeySchemas(name, schemas, { scoped, definitions,
            isolated: isIsolatedPropertyDefinition(capture.uniqueConstraint!, scoped, removedWith),
            ignoreCasing: capture.uniqueConstraint!.ignoreCasing });
    }
}

function hasUnselectedReferences(ids: readonly (string | undefined)[], selectedIds: ReadonlySet<string>): boolean {
    return ids.some(id => id !== undefined && !selectedIds.has(id));
}

function isIsolatedPropertyDefinition(unique: UniqueConstraintCapture, scoped: boolean, removedWith: readonly (string | undefined)[]): boolean {
    return !scoped && unique.eventDefinitions.length === 1 && !removedWith.some(id => id !== undefined);
}

function scenarioConstraints(definitions: ReadonlyMap<string, ConstraintCapture>, selectedIds: ReadonlySet<string>,
    constructors: ReadonlyMap<string, Function>): InProcessConstraints {
    // Other-sequence definitions neither validate nor index this scenario's event log.
    const eventLog = EventSequenceId.eventLog.value;
    const applicable = new Map([...definitions].filter(([, capture]) =>
        !capture.eventSequences?.length || capture.eventSequences.includes(eventLog)));
    const inapplicable = new Set([...definitions.keys()].filter(name => !applicable.has(name)));
    const ignoredRemovals = new Set([...definitions].filter(([name]) => inapplicable.has(name)).flatMap(([, capture]) =>
        [capture.uniqueConstraint?.removedWithEventTypeId, ...(capture.uniqueConstraint?.removedWithEventTypeIds ?? [])]
            .filter((id): id is string => id !== undefined)));
    const schemas = new Map([...constructors].filter(([id]) => selectedIds.has(id)).map(([id, type]) => [id, getEventTypeMetadata(type)!.schema]));
    const constraints = new InProcessConstraints(applicable, schemas, inapplicable, ignoredRemovals);
    const count = supportsPropertyOverlap(applicable, schemas) ? 1 : applicable.size;
    for (const [name, capture] of applicable) validateScenarioDefinition(name, capture, { selectedIds, constructors, definitions: count });
    return constraints;
}

function hasConstraintDecorators(type: Function): boolean {
    return getUniqueEventMetadata(type) !== undefined || getRemovedConstraintNames(type).length > 0 ||
        TypeIntrospector.getTrackedProperties(type).some(property => getUniquePropertyMetadata(type, property) !== undefined);
}

function compileScenarioConstraints(eventTypes: Constructor[], discoveredArtifacts: DefaultClientArtifactsProvider | undefined,
    discovered: Constructor[] | undefined): InProcessConstraints {
    validateConstraintMetadata(discovered ?? []);
    try {
        // Keep global decorator contributions. A shadowed ID is accepted only when neither
        // constructor has constraint decorators, so either one compiles to the same constraints.
        const compiledEventTypes = [...new Set([...(discoveredArtifacts?.eventTypes ?? []), ...eventTypes])];
        const constructorsById = constraintConstructors(compiledEventTypes);
        const compiled = compileConstraints({ eventTypes: [...constructorsById.values()], constraints: discovered ?? [] });
        const selectedIds = new Set(eventTypes.map(type => getEventTypeFor(type).id.value));
        const definitions = discoveredArtifacts ? new Map([...compiled].filter(([, capture]) => referencesSelectedType(capture, selectedIds))) : compiled;
        validateRemovalReferences(eventTypes, definitions);
        return scenarioConstraints(definitions, selectedIds, constructorsById);
    } catch (error) {
        if (error instanceof UnsupportedEventSequenceOperation) throw error;
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', 'compiler', `Invalid constraint definition: ${String(error)}.`);
    }
}

function validateConstraintMetadata(discovered: Constructor[]): void {
    for (const type of discovered) {
        if (!getConstraintMetadata(type)) throw new UnsupportedEventSequenceOperation('artifacts.constraints', type.name,
            'Every selected constraint must have @constraint metadata.');
    }
}

function constraintConstructors(eventTypes: Constructor[]): Map<string, Constructor> {
    const constructors = new Map<string, Constructor>();
    for (const type of eventTypes) {
        const id = getEventTypeFor(type).id.value;
        const previous = constructors.get(id);
        if (hasConflictingConstraintDecorators(previous, type)) {
            throw new UnsupportedEventSequenceOperation('artifacts.eventTypes', id,
                'Conflicting constructors share an event type ID; constraint discovery cannot choose one.');
        }
        constructors.set(id, type);
    }
    return constructors;
}

function hasConflictingConstraintDecorators(previous: Function | undefined, type: Function): boolean {
    return previous !== undefined && previous !== type && (hasConstraintDecorators(previous) || hasConstraintDecorators(type));
}

function referencesSelectedType(capture: ConstraintCapture, selectedIds: ReadonlySet<string>): boolean {
    const { ids, removedWith } = constraintReferences(capture);
    return [...ids, ...removedWith].some(id => id !== undefined && selectedIds.has(id));
}

function validateRemovalReferences(eventTypes: Constructor[], definitions: ReadonlyMap<string, ConstraintCapture>): void {
    for (const type of eventTypes) {
        for (const name of getRemovedConstraintNames(type)) {
            if (!definitions.has(name)) {
                throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                    'Unresolved removal constraint name in the selected catalog.');
            }
        }
    }
}

/** A kernel-free, fixture-bounded append scenario. No observer runs automatically. */
export class EventScenario {
    readonly eventSequence: IEventSequence;
    readonly given: EventScenarioGivenBuilder;
    readonly when: EventScenarioWhenBuilder;

    constructor(options: EventScenarioOptions = {}) {
        const selectedArtifacts = options.artifacts;
        const selectedConstraints = selectedArtifacts?.constraints;
        const artifacts = selectedArtifacts ?? new DefaultClientArtifactsProvider(TypeDiscoverer.default);
        const eventTypes = [...artifacts.eventTypes];
        if (selectedConstraints?.length === 0 && options.constraints !== 'disabled') {
            throw new UnsupportedEventSequenceOperation('artifacts.constraints', 'empty constraint catalog',
                'An empty selected catalog cannot silently disable constraint discovery; set constraints: disabled explicitly.');
        }
        const discoveredArtifacts = selectedArtifacts && selectedConstraints === undefined
            ? new DefaultClientArtifactsProvider(TypeDiscoverer.default) : undefined;
        const discovered = selectedConstraints ?? discoveredArtifacts?.constraints ?? artifacts.constraints;
        const constraints = options.constraints === 'disabled' ? undefined
            : compileScenarioConstraints(eventTypes, discoveredArtifacts, discovered);
        if (artifacts.eventTypeMigrations?.length) {
            throw new UnsupportedEventSequenceOperation('artifacts.eventTypeMigrations', artifacts.eventTypeMigrations.map(type => type.name).join(', '),
                'Migrations are not fixture-backed.');
        }
        const sequence = new InProcessEventSequence(options, eventTypes, constraints);
        this.eventSequence = sequence;
        registerScenarioSeed(this, (source, events, options) => sequence.seed(source, events, options));
        this.given = new EventScenarioGivenBuilder(this);
        this.when = new EventScenarioWhenBuilder(this);
    }

    /** Alias for the default event-log sequence only. */
    get eventLog(): IEventLog {
        if (this.eventSequence.id.value !== EventSequenceId.eventLog.value) {
            throw new UnsupportedEventSequenceOperation('eventLog', this.eventSequence.id.value, 'Only the default sequence is an event log.');
        }
        return this.eventSequence;
    }
    async append(source: string, event: object, options?: AppendOptions): Promise<AppendResult> {
        return this.eventSequence.append(source, event, options);
    }
    appendMany(source: string, events: object[], options?: AppendOptions): Promise<AppendResult[]>;
    appendMany(events: EventForEventSourceId[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(sourceOrEvents: string | EventForEventSourceId[], eventsOrOptions?: object[] | AppendOptions, options?: AppendOptions): Promise<AppendResult[]> {
        if (typeof sourceOrEvents === 'string') {
            return this.eventSequence.appendMany(sourceOrEvents, eventsOrOptions as object[], options);
        }
        return this.eventSequence.appendMany(sourceOrEvents, eventsOrOptions as AppendOptions | undefined);
    }
    get results(): readonly AppendResult[] { return (this.eventSequence as InProcessEventSequence).results; }
    get appendedEvents(): readonly AppendedEvent[] { return (this.eventSequence as InProcessEventSequence).appendedEvents; }

    /** Assertion view, not a callable Promise-like then method. */
    get then(): { readonly results: readonly AppendResult[]; readonly appendedEvents: readonly AppendedEvent[] } {
        return { results: this.results, appendedEvents: this.appendedEvents };
    }
}
