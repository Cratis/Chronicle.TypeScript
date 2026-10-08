// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
import { getUniqueEventMetadata, getUniquePropertyMetadata } from '../events/constraints/unique.js';
import { getRemovedConstraintNames } from '../events/constraints/removeConstraint.js';
import { getConstraintMetadata } from '../events/constraints/constraint.js';
import { InProcessConstraints } from './InProcessConstraints.js';
import type { EventScenarioOptions } from './EventScenarioOptions.js';
import { EventScenarioGivenBuilder } from './EventScenarioGivenBuilder.js';
import { EventScenarioWhenBuilder } from './EventScenarioWhenBuilder.js';
import { InProcessEventSequence } from './InProcessEventSequence.js';
import { registerScenarioSeed } from './EventScenarioSeed.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

function hasConstraintDecorators(type: Function): boolean {
    return getUniqueEventMetadata(type) !== undefined || getRemovedConstraintNames(type).length > 0 ||
        TypeIntrospector.getTrackedProperties(type).some(property => getUniquePropertyMetadata(type, property) !== undefined);
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
        let constraints: InProcessConstraints | undefined;
        if (options.constraints !== 'disabled') {
            for (const type of discovered ?? []) {
                if (!getConstraintMetadata(type)) throw new UnsupportedEventSequenceOperation('artifacts.constraints', type.name,
                    'Every selected constraint must have @constraint metadata.');
            }
            try {
                // Keep global decorator contributions. A shadowed ID is accepted only when neither
                // constructor has constraint decorators, so either one compiles to the same constraints.
                const compiledEventTypes = [...new Set([...(discoveredArtifacts?.eventTypes ?? []), ...eventTypes])];
                const constructorsById = new Map<string, (typeof eventTypes)[number]>();
                for (const type of compiledEventTypes) {
                    const id = getEventTypeFor(type).id.value;
                    const previous = constructorsById.get(id);
                    if (previous && previous !== type && (hasConstraintDecorators(previous) || hasConstraintDecorators(type))) {
                        throw new UnsupportedEventSequenceOperation('artifacts.eventTypes', id,
                            'Conflicting constructors share an event type ID; constraint discovery cannot choose one.');
                    }
                    constructorsById.set(id, type);
                }
                const compiled = compileConstraints({ eventTypes: [...constructorsById.values()], constraints: discovered ?? [] });
                const selectedIds = new Set(eventTypes.map(type => getEventTypeFor(type).id.value));
                const definitions = discoveredArtifacts ? new Map([...compiled].filter(([, capture]) => {
                    const constrained = capture.uniqueConstraint?.eventDefinitions.map(entry => entry.eventTypeId) ??
                        capture.uniqueEventType?.eventTypeIds ?? [capture.uniqueEventType?.eventTypeId];
                    const removedWith = [...(capture.uniqueConstraint?.removedWithEventTypeIds ?? []),
                        capture.uniqueConstraint?.removedWithEventTypeId,
                        ...(capture.uniqueEventType?.removedWithEventTypeIds ?? [])];
                    return [...constrained, ...removedWith].some(id => id !== undefined && selectedIds.has(id));
                })) : compiled;
                for (const type of eventTypes) {
                    for (const name of getRemovedConstraintNames(type)) {
                        if (!definitions.has(name)) {
                            throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                                'Unresolved removal constraint name in the selected catalog.');
                        }
                    }
                }
                // The scenario appends to the event log only. A definition scoped to other event sequences is neither
                // validated nor indexed there by the kernel (constraints-event-sequences.json), so it takes no part.
                const eventLog = EventSequenceId.eventLog.value;
                const applicable = new Map([...definitions].filter(([, capture]) =>
                    !capture.eventSequences?.length || capture.eventSequences.includes(eventLog)));
                const inapplicable = new Set([...definitions.keys()].filter(name => !applicable.has(name)));
                constraints = new InProcessConstraints(applicable, new Map(eventTypes.map(type =>
                    [getEventTypeFor(type).id.value, getEventTypeMetadata(type)!.schema])), inapplicable);
                for (const [name, capture] of applicable) {
                    const ids = capture.uniqueConstraint?.eventDefinitions.map(entry => entry.eventTypeId) ??
                        capture.uniqueEventType?.eventTypeIds ?? [capture.uniqueEventType?.eventTypeId];
                    const removedWith = [...(capture.uniqueConstraint?.removedWithEventTypeIds ?? []),
                        capture.uniqueConstraint?.removedWithEventTypeId,
                        ...(capture.uniqueEventType?.removedWithEventTypeIds ?? [])];
                    if ([...ids, ...removedWith].some(id => id !== undefined && !selectedIds.has(id))) {
                        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                            'Every constrained event type must be in the selected catalog. Claiming and removal references must be complete.');
                    }
                    const scoped = Object.values(capture.scope).some(Boolean);
                    if (scoped && removedWith.some(id => {
                        const type = eventTypes.find(type => getEventTypeFor(type).id.value === id);
                        return type && Object.keys(getEventTypeMetadata(type)?.schema.properties ?? {}).length === 0;
                    })) {
                        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                            'Scoped fieldless removal events are not fixture-backed.');
                    }
                    for (const entry of capture.uniqueConstraint?.eventDefinitions ?? []) {
                        const type = eventTypes.find(type => getEventTypeFor(type).id.value === entry.eventTypeId)!;
                        const schemas = entry.properties.map(property => getEventTypeMetadata(type)?.schema.properties?.[property]);
                        const plainStrings = schemas.every(schema => schema?.type === 'string' && schema.format === undefined);
                        if (scoped && !plainStrings) {
                            throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                                'Scoped property keys must be schema-backed strings.');
                        }
                        for (const schema of schemas) {
                            const supported = schema?.type === 'boolean' && schema.format === undefined ||
                                schema?.type === 'string' && (schema.format === undefined || schema.format === 'guid') ||
                                schema?.type === 'number' && (schema.format === undefined || schema.format === 'double');
                            if (!supported) throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                                `Unique keys with schema ${schema?.type ?? 'missing'}/${schema?.format ?? 'unformatted'} are not fixture-backed; date, object and other numeric formats require a kernel-backed test.`);
                        }
                        const extendedKey = schemas.some(schema => schema?.type === 'number' || schema?.format === 'guid');
                        if (extendedKey && (applicable.size !== 1 || capture.uniqueConstraint!.eventDefinitions.length !== 1 ||
                            removedWith.some(id => id !== undefined))) {
                            throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                                'Guid and numeric keys require one isolated definition covering one event type without removers; shared definitions and removal combinations are not fixture-backed.');
                        }
                        // constraints-ignore-casing.json captures folded string keys only.
                        if (capture.uniqueConstraint!.ignoreCasing && !plainStrings) {
                            throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                                'Case-insensitive keys must be schema-backed strings.');
                        }
                        // constraints-composite.json captures string components only.
                        if (entry.properties.length > 1 && !plainStrings) {
                            throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                                'Every property of a composite key must be a schema-backed string.');
                        }
                    }
                }
            } catch (error) {
                if (error instanceof UnsupportedEventSequenceOperation) throw error;
                throw new UnsupportedEventSequenceOperation('artifacts.constraints', 'compiler', `Invalid constraint definition: ${String(error)}.`);
            }
        }
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
