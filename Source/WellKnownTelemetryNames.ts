// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Public telemetry names following the shared Cratis OpenTelemetry convention. */
export const WellKnownTelemetryNames = {
    scope: 'Cratis.Chronicle.Client',
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
    spans: {
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
    }
} as const;
