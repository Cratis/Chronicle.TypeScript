// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { AppendResult } from '../eventSequences/AppendResult.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { IEventSequence } from '../eventSequences/IEventSequence.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { getEventTypeFor, getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { compileConstraints } from '../events/constraints/Constraints.js';
import { getConstraintMetadata } from '../events/constraints/constraint.js';
import { InProcessConstraints } from './InProcessConstraints.js';
import type { EventScenarioOptions } from './EventScenarioOptions.js';
import { EventScenarioGivenBuilder } from './EventScenarioGivenBuilder.js';
import { EventScenarioWhenBuilder } from './EventScenarioWhenBuilder.js';
import { InProcessEventSequence } from './InProcessEventSequence.js';
import { registerScenarioSeed } from './EventScenarioSeed.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

/** A kernel-free, fixture-bounded append scenario. No observer runs automatically. */
export class EventScenario {
    readonly eventSequence: IEventSequence;
    readonly given: EventScenarioGivenBuilder;
    readonly when: EventScenarioWhenBuilder;

    constructor(options: EventScenarioOptions = {}) {
        const artifacts = options.artifacts ?? new DefaultClientArtifactsProvider(TypeDiscoverer.default);
        const eventTypes = [...artifacts.eventTypes];
        if (options.artifacts?.constraints?.length === 0 && options.constraints !== 'disabled') {
            throw new UnsupportedEventSequenceOperation('artifacts.constraints', 'empty constraint catalog',
                'An empty selected catalog cannot silently disable constraint discovery; set constraints: disabled explicitly.');
        }
        const discovered = options.artifacts?.constraints ?? artifacts.constraints;
        let constraints: InProcessConstraints | undefined;
        if (options.constraints !== 'disabled') {
            for (const type of discovered ?? []) {
                if (!getConstraintMetadata(type)) throw new UnsupportedEventSequenceOperation('artifacts.constraints', type.name,
                    'Every selected constraint must have @constraint metadata.');
            }
            try {
                const definitions = compileConstraints({ ...artifacts, eventTypes, constraints: discovered ?? [] });
                constraints = new InProcessConstraints(definitions);
                for (const [name, capture] of definitions) {
                    const ids = capture.uniqueConstraint?.eventDefinitions.map(entry => entry.eventTypeId) ??
                        capture.uniqueEventType?.eventTypeIds ?? [capture.uniqueEventType?.eventTypeId];
                    if (ids.some(id => !eventTypes.some(type => getEventTypeFor(type).id.value === id))) {
                        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                            'Every constrained event type must be in the selected catalog.');
                    }
                    for (const entry of capture.uniqueConstraint?.eventDefinitions ?? []) {
                        const type = eventTypes.find(type => getEventTypeFor(type).id.value === entry.eventTypeId)!;
                        if (getEventTypeMetadata(type)?.schema.properties?.[entry.properties[0]]?.type !== 'string') {
                            throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
                                'The constrained property must be a schema-backed string.');
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
        registerScenarioSeed(this, (source, events) => sequence.seed(source, events));
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
