// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Public telemetry names, including retained TypeScript compatibility constants. */
export const WellKnownTelemetryNames = {
    scope: 'Cratis.Chronicle.Client',
    /**
     * @deprecated Use scope. This historical scope is no longer emitted; the constant remains available.
     * The revised timetable replaces the earlier "next major" plan: built-in legacy emission ends in an
     * upcoming minor after ADR 0001's one-minor overlap. See https://github.com/Cratis/Chronicle.TypeScript/issues/171.
     */
    legacyScope: '@cratis/chronicle',
    attributes: {
        correlationId: 'cratis.correlation_id',
        eventStore: 'cratis.event_store.name',
        namespace: 'cratis.event_store.namespace',
        eventSequenceId: 'cratis.event_sequence.id',
        sequenceNumber: 'cratis.event_sequence.number',
        eventTypeId: 'cratis.event_type.id',
        eventTypeGeneration: 'cratis.event_type.generation',
        eventSourceType: 'cratis.event_source.type',
        eventSourceId: 'cratis.event_source.id',
        eventCount: 'cratis.event.count',
        hasEvents: 'cratis.chronicle.event_sequence.has_events',
        eventStreamType: 'cratis.chronicle.event_stream.type',
        eventStreamId: 'cratis.chronicle.event_stream.id',
        errorType: 'error.type',
        exceptionType: 'exception.type'
    },
    /**
     * @deprecated Use attributes. These constants remain available without a removal deadline.
     * Replacing the earlier "next major" plan, built-in legacy attribute emission ends in an upcoming minor
     * after ADR 0001's one-minor overlap, except the exact-string sequenceNumber attribute.
     * See https://github.com/Cratis/Chronicle.TypeScript/issues/171.
     */
    legacyAttributes: {
        eventStore: 'chronicle.event_store',
        namespace: 'chronicle.namespace',
        eventSequenceId: 'chronicle.event_sequence_id',
        sequenceNumber: 'chronicle.sequence_number',
        eventTypeId: 'chronicle.event_type_id',
        eventTypeGeneration: 'chronicle.event_type_generation',
        eventSourceId: 'chronicle.event_source_id',
        eventCount: 'chronicle.events_count',
        hasEvents: 'chronicle.has_events',
        eventStreamType: 'chronicle.event_stream_type',
        eventStreamId: 'chronicle.event_stream_id'
    },
    /**
     * @deprecated Use conventionSpans. These legacy constants remain available without a removal deadline.
     * Replacing the earlier "next major" plan, built-in legacy span emission ends in an upcoming minor
     * after ADR 0001's one-minor overlap. See https://github.com/Cratis/Chronicle.TypeScript/issues/171.
     */
    spans: {
        append: 'chronicle.event_sequences.append',
        appendMany: 'chronicle.event_sequences.append_many',
        getTailSequenceNumber: 'chronicle.event_sequences.get_tail_sequence_number',
        hasEventsFor: 'chronicle.event_sequences.has_events_for',
        getForEventSourceIdAndEventTypes: 'chronicle.event_sequences.get_for_event_source_id_and_event_types',
        getFromSequenceNumber: 'chronicle.event_sequences.get_from_sequence_number',
        redact: 'chronicle.event_sequences.redact',
        redactForEventSource: 'chronicle.event_sequences.redact_for_event_source',
        completeStream: 'chronicle.event_sequences.complete_stream',
        getEventStore: 'chronicle.client.get_event_store',
        getEventStores: 'chronicle.client.get_event_stores',
        getNamespaces: 'chronicle.event_store.get_namespaces'
    },
    conventionSpans: {
        append: 'cratis.chronicle.client.event_sequence.append',
        appendMany: 'cratis.chronicle.client.event_sequence.append_many',
        getTailSequenceNumber: 'cratis.chronicle.client.event_sequence.get_tail_sequence_number',
        hasEventsFor: 'cratis.chronicle.client.event_sequence.has_events_for',
        getForEventSourceIdAndEventTypes: 'cratis.chronicle.client.event_sequence.get_for_event_source_id_and_event_types',
        getFromSequenceNumber: 'cratis.chronicle.client.event_sequence.get_from_sequence_number',
        redact: 'cratis.chronicle.client.event_sequence.redact',
        redactForEventSource: 'cratis.chronicle.client.event_sequence.redact_for_event_source',
        completeStream: 'cratis.chronicle.client.event_sequence.complete_stream',
        getEventStore: 'cratis.chronicle.client.event_store.get',
        getEventStores: 'cratis.chronicle.client.event_store.list',
        getNamespaces: 'cratis.chronicle.client.event_store.get_namespaces'
    },
    metrics: {
        eventsAppended: 'cratis.chronicle.event_sequence.appended',
        batchAppendsPerformed: 'cratis.chronicle.event_sequence.batch_appends',
        eventStoreRetrievals: 'cratis.chronicle.event_store.retrievals',
        appendDuration: 'cratis.chronicle.event_sequence.append_duration',
        appendManyDuration: 'cratis.chronicle.event_sequence.append_many_duration',
        constraintViolations: 'cratis.chronicle.event_sequence.constraint_violations',
        appendErrors: 'cratis.chronicle.event_sequence.append_errors'
    },
    /**
     * @deprecated Use metrics (duration units are seconds). These constants remain available without a removal deadline.
     * Replacing the earlier "next major" plan, built-in legacy metric emission ends in an upcoming minor
     * after ADR 0001's one-minor overlap. ChronicleMetrics retains compatibility recording.
     * See https://github.com/Cratis/Chronicle.TypeScript/issues/171.
     */
    legacyMetrics: {
        eventsAppended: 'chronicle.events.appended',
        batchAppendsPerformed: 'chronicle.events.batch_appends',
        eventStoreRetrievals: 'chronicle.client.event_store_retrievals',
        appendDuration: 'chronicle.events.append_duration',
        appendManyDuration: 'chronicle.events.append_many_duration',
        constraintViolations: 'chronicle.events.constraint_violations',
        appendErrors: 'chronicle.events.append_errors'
    }
} as const;
