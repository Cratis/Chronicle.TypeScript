// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendedEvent } from '../events/AppendedEvent.js';
import { EventObservationState } from '@cratis/chronicle.contracts';
import { getEventTypeFor } from '../events/eventTypeDecorator.js';
import { Tag } from '../events/Tag.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { AppendResult } from '../eventSequences/AppendResult.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { prepareBatchAppend } from '../eventSequences/prepareBatchAppend.js';
import { InProcessAppendMetadata } from './InProcessAppendMetadata.js';
import { InProcessEventPayload } from './InProcessEventPayload.js';
import type { InProcessEventSequenceEnvironment } from './InProcessEventSequenceEnvironment.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

/** Stages a complete batch; the sequence alone decides whether to commit it. */
export class InProcessBatchAppend {
    private readonly metadata: InProcessAppendMetadata;

    constructor(private readonly environment: InProcessEventSequenceEnvironment, private readonly payload: InProcessEventPayload,
        private readonly success: (sequence: EventSequenceNumber, artifact: string) => AppendResult) {
        this.metadata = new InProcessAppendMetadata(environment);
    }

    prepare(sourceOrEvents: string | EventForEventSourceId[], eventsOrOptions: object[] | AppendOptions | undefined, options: AppendOptions | undefined, position: number) {
        const entries = typeof sourceOrEvents === 'string' ? eventsOrOptions as object[] : sourceOrEvents;
        const shared = typeof sourceOrEvents === 'string' ? options : eventsOrOptions as AppendOptions | undefined;
        this.validateEntries(entries, shared, typeof sourceOrEvents === 'string');
        const prepared = this.serialize(sourceOrEvents, entries, shared);
        this.metadata.guid(prepared.correlationId, 'appendMany.correlationId');
        this.context(prepared, entries.length);
        const staged = prepared.eventsForEventSourceIds.map((_, index) => this.stage(prepared, index, position));
        return { prepared, staged };
    }

    private validateEntries(entries: object[], shared: AppendOptions | undefined, sameSource: boolean): void {
        this.array(entries);
        this.metadata.batch(shared);
        if (shared?.occurred !== undefined) this.metadata.checkedDate(shared.occurred, 'appendMany.occurred');
        for (const entry of entries) {
            if (sameSource) break;
            this.metadata.entry(entry as EventForEventSourceId);
        }
    }

    private array(entries: object[]): void {
        if (!Array.isArray(entries)) throw this.environment.unsupported('appendMany.arguments', this.environment.sequenceId, 'Events must be an array.');
        if (!entries.length) throw this.environment.unsupported('appendMany.empty', this.environment.sequenceId, 'The kernel rejects an empty batch.');
    }

    private serialize(sourceOrEvents: string | EventForEventSourceId[], entries: object[], shared?: AppendOptions) {
        try {
            const batchOptions = this.options(shared);
            if (batchOptions?.correlationId !== undefined) this.metadata.guid(batchOptions.correlationId, 'appendMany.correlationId');
            return typeof sourceOrEvents === 'string'
                ? prepareBatchAppend(sourceOrEvents, entries, batchOptions)
                : prepareBatchAppend(sourceOrEvents, batchOptions);
        } catch (error) {
            if (error instanceof UnsupportedEventSequenceOperation) throw error;
            throw this.environment.unsupported('appendMany.serialization', this.environment.sequenceId, `Batch preparation failed: ${String(error)}.`);
        }
    }

    private options(shared?: AppendOptions): AppendOptions | undefined {
        return shared?.correlationId === undefined && this.environment.correlationId ? this.withCorrelation(shared) : shared;
    }

    private withCorrelation(shared?: AppendOptions): AppendOptions {
        const metadata = shared ?? {};
        return { correlationId: this.environment.correlationId!(), sourceType: metadata.sourceType, streamType: metadata.streamType,
            streamId: metadata.streamId, subject: metadata.subject, occurred: metadata.occurred, tags: metadata.tags,
            namedTags: metadata.namedTags };
    }

    private context({ identity, batchCausationChain }: ReturnType<typeof prepareBatchAppend>, count: number): void {
        if (!this.metadata.ambientContext(identity, batchCausationChain) || !this.batchContext(batchCausationChain, count)) {
            throw this.environment.unsupported('appendMany.context', this.environment.sequenceId, 'Ambient identity or causation metadata is not fixture-backed.');
        }
    }

    private batchContext(chain: ReturnType<typeof prepareBatchAppend>['batchCausationChain'], count: number): boolean {
        return chain[1].type.name === 'TypeScriptClient.AppendMany' && chain[1].properties.count === String(count);
    }

    private stage(prepared: ReturnType<typeof prepareBatchAppend>, index: number, position: number) {
        const { eventSourceId, event } = prepared.eventsForEventSourceIds[index];
        this.eventInstance(event);
        this.metadata.source(eventSourceId, 'appendMany.source');
        const wire = prepared.eventsToAppend[index];
        this.route(wire);
        this.tags(wire, event);
        const occurred = wire.Occurred ? this.metadata.checkedDate(new Date(wire.Occurred.Value), 'appendMany.occurred')
            : this.metadata.checkedDate(this.environment.clock(), 'appendMany.clock');
        const content = this.payload.checkedContent(event, wire.Content, 'appendMany.content');
        const hash = this.payload.hash(wire.EventType.Id, eventSourceId, content);
        const sequenceNumber = new EventSequenceNumber(BigInt(position + index));
        const eventType = getEventTypeFor(event.constructor);
        const stored: AppendedEvent = { eventType, content, context: {
            eventStore: this.environment.store, namespace: this.environment.namespace, sequenceNumber: sequenceNumber.value, eventSourceId,
            eventSourceType: wire.EventSourceType || 'Default', eventStreamType: wire.EventStreamType || 'All',
            eventStreamId: wire.EventStreamId || 'Default', subject: this.metadata.storedSubject(wire.Subject, eventSourceId), hash, causedBy: prepared.identity,
            observationState: EventObservationState.Initial, eventType, occurred, correlationId: prepared.correlationId.toString(),
            causation: prepared.batchCausationChain.map(item => ({ type: item.type.name, occurred: item.occurred, properties: { ...item.properties } })),
            tags: wire.Tags.map(tag => new Tag(tag)), namedTags: []
        } };
        return { stored, result: this.success(sequenceNumber, event.constructor.name) };
    }

    private eventInstance(event: object): void {
        if (!this.registeredEvent(event)) {
            throw this.environment.unsupported('appendMany.event', event?.constructor?.name ?? this.environment.sequenceId, 'Event is not in the selected catalog.');
        }
    }

    private registeredEvent(event: object): boolean {
        return !!event && typeof event === 'object' && this.environment.catalog.has(event.constructor);
    }

    private route(wire: ReturnType<typeof prepareBatchAppend>['eventsToAppend'][number]): void {
        for (const [name, value] of Object.entries({ sourceType: wire.EventSourceType, streamType: wire.EventStreamType, streamId: wire.EventStreamId })) {
            if (value !== undefined && !this.routeIdentifier(value)) {
                throw this.environment.unsupported(`appendMany.${name}`, String(value), 'Only simple metadata identifiers are fixture-backed.');
            }
        }
    }

    private routeIdentifier(value: unknown): boolean {
        return typeof value === 'string' && /^[A-Za-z0-9_-]*$/.test(value);
    }

    private tags(wire: ReturnType<typeof prepareBatchAppend>['eventsToAppend'][number], event: object): void {
        if (wire.Tags.some(tag => !/^[A-Za-z0-9_-]+$/.test(tag))) {
            throw this.environment.unsupported('appendMany.tags', event.constructor.name, 'Only simple string tags are fixture-backed.');
        }
    }
}
