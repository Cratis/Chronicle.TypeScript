// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Literal compatibility contract, independent of the production name selection. */
export const legacySpans = {
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
} as const;

export const conventionSpans = {
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
} as const;
