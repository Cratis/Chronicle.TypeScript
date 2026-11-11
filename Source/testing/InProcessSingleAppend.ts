// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { toContractsGuid } from '../connection/Guid.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import { EventObservationState } from '@cratis/chronicle.contracts';
import { Tag } from '../events/Tag.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { prepareSingleAppend } from '../eventSequences/prepareSingleAppend.js';
import { InProcessAppendMetadata } from './InProcessAppendMetadata.js';
import { InProcessEventPayload } from './InProcessEventPayload.js';
import type { InProcessEventSequenceEnvironment } from './InProcessEventSequenceEnvironment.js';
import { singleAppendRoute } from './singleAppendRoute.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

/** Prepares one append without allocating history, results, or notifications. */
export class InProcessSingleAppend {
    private readonly metadata: InProcessAppendMetadata;

    constructor(private readonly environment: InProcessEventSequenceEnvironment, private readonly payload: InProcessEventPayload) {
        this.metadata = new InProcessAppendMetadata(environment);
    }

    prepare(eventSourceId: string, event: object, options: AppendOptions | undefined, position: number) {
        this.eventInstance(event);
        if (!/^[A-Za-z0-9_-]+$/.test(eventSourceId)) throw this.environment.unsupported('append.source', eventSourceId, 'Only simple source identifiers are fixture-backed.');
        const route = singleAppendRoute(options, event.constructor.name, this.environment.unsupported, true);
        if (!this.environment.catalog.get(event.constructor)) throw this.environment.unsupported('append.event', event.constructor.name, 'Event is not in the selected, validated catalog.');
        const { prepared, content } = this.serialize(event, options);
        this.correlation(prepared, event);
        this.context(prepared, event);
        const occurred = this.occurred(event);
        const hash = this.payload.hash(prepared.eventType.id.value, eventSourceId, content);
        const sequenceNumber = new EventSequenceNumber(BigInt(position));
        const stored: AppendedEvent = {
            eventType: prepared.eventType,
            content,
            context: {
                eventStore: this.environment.store, namespace: this.environment.namespace,
                sequenceNumber: sequenceNumber.value, eventSourceId,
                eventSourceType: route.sourceType, eventStreamType: route.streamType, eventStreamId: route.streamId,
                subject: this.metadata.storedSubject(prepared.subject, eventSourceId), hash, causedBy: prepared.identity, observationState: EventObservationState.Initial,
                eventType: prepared.eventType, occurred, correlationId: prepared.correlationId.toString(),
                causation: prepared.causationChain.map(item => ({ type: item.type.name, occurred: item.occurred, properties: { ...item.properties } })),
                tags: prepared.tags.map(tag => new Tag(tag)), namedTags: []
            }
        };
        return { prepared, stored, sequenceNumber };
    }

    private eventInstance(event: object): void {
        if (!event || typeof event !== 'object') throw this.environment.unsupported('append.event', this.environment.sequenceId, 'Only registered event instances are supported.');
    }

    private serialize(event: object, options?: AppendOptions) {
        try {
            const prepared = prepareSingleAppend(event, this.options(options));
            const content = this.payload.checkedContent(event, prepared.content, 'append.content',
                'Content differs from the event schema; null, missing and extra values are not proven.');
            return { prepared, content };
        } catch (error) {
            if (error instanceof UnsupportedEventSequenceOperation) throw error;
            throw this.environment.unsupported('append.serialization', event.constructor.name, `Payload or metadata could not be serialized: ${String(error)}.`);
        }
    }

    private options(options?: AppendOptions): AppendOptions {
        return { subject: options?.subject, correlationId: this.environment.correlationId?.() };
    }

    private correlation(prepared: ReturnType<typeof prepareSingleAppend>, event: object): void {
        try {
            toContractsGuid(prepared.correlationId);
            if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(prepared.correlationId.toString())) throw new Error('Invalid correlation ID.');
        } catch {
            throw this.environment.unsupported('append.correlationId', event.constructor.name, 'Correlation ID must be a valid GUID.');
        }
    }

    private context(prepared: ReturnType<typeof prepareSingleAppend>, event: object): void {
        if (!this.metadata.ambientContext(prepared.identity, prepared.causationChain)) {
            throw this.environment.unsupported('append.context', event.constructor.name, 'Ambient identity or causation metadata is not fixture-backed.');
        }
    }

    private occurred(event: object): Date {
        const occurred = this.environment.clock();
        // Date has millisecond precision; only the UTC year range representable by DateTimeOffset is supported.
        if (!(occurred instanceof Date) || !this.validTime(occurred)) {
            throw this.environment.unsupported('append.clock', event.constructor.name, 'Clock must return a valid Date within UTC years 1–9999 (millisecond precision).');
        }
        return occurred;
    }

    private validTime(value: Date): boolean {
        return !Number.isNaN(value.getTime()) && value.getUTCFullYear() >= 1 && value.getUTCFullYear() <= 9999;
    }
}
