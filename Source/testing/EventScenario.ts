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
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getUniqueEventMetadata, getUniquePropertyMetadata } from '../events/constraints/unique.js';
import type { EventScenarioOptions } from './EventScenarioOptions.js';
import { EventScenarioGivenBuilder } from './EventScenarioGivenBuilder.js';
import { EventScenarioWhenBuilder } from './EventScenarioWhenBuilder.js';
import { InProcessEventSequence } from './InProcessEventSequence.js';
import { registerScenarioSeed } from './EventScenarioSeed.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

/** A kernel-free, fixture-bounded single-event append scenario. No observer runs automatically. */
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
        const discovered = options.artifacts?.constraints ?? new DefaultClientArtifactsProvider(TypeDiscoverer.default).constraints;
        if (options.constraints !== 'disabled' && (discovered.length || eventTypes.some(type => {
            const metadata = getEventTypeMetadata(type);
            return getUniqueEventMetadata(type) || [...(metadata?.members.keys() ?? [])].some(key => getUniquePropertyMetadata(type, key));
        }))) {
            throw new UnsupportedEventSequenceOperation('artifacts.constraints', discovered.map(type => type.name).join(', ') || 'event metadata',
                'Constraint definitions are rejected until kernel-backed constraint fixtures are available.');
        }
        if (artifacts.eventTypeMigrations?.length) {
            throw new UnsupportedEventSequenceOperation('artifacts.eventTypeMigrations', artifacts.eventTypeMigrations.map(type => type.name).join(', '),
                'Migrations are not fixture-backed.');
        }
        const sequence = new InProcessEventSequence(options, eventTypes);
        this.eventSequence = sequence;
        registerScenarioSeed(this, (source, event) => sequence.seed(source, event));
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
    async appendMany(_sourceOrEvents: string | EventForEventSourceId[], _eventsOrOptions?: object[] | AppendOptions, _options?: AppendOptions): Promise<AppendResult[]> {
        throw new UnsupportedEventSequenceOperation('appendMany', this.eventSequence.id.value,
            'Both batch overloads require kernel-backed atomicity fixtures.');
    }
    get results(): readonly AppendResult[] { return (this.eventSequence as InProcessEventSequence).results; }
    get appendedEvents(): readonly AppendedEvent[] { return (this.eventSequence as InProcessEventSequence).appendedEvents; }

    /** Assertion view, not a callable Promise-like then method. */
    get then(): { readonly results: readonly AppendResult[]; readonly appendedEvents: readonly AppendedEvent[] } {
        return { results: this.results, appendedEvents: this.appendedEvents };
    }
}
