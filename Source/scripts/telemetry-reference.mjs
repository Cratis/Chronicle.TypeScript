// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Historical migration inputs only, not exported telemetry names or emitted instruments.
const removedNames = {
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
    attributes: {
        eventStore: 'chronicle.event_store', namespace: 'chronicle.namespace',
        eventSequenceId: 'chronicle.event_sequence_id', sequenceNumber: 'chronicle.sequence_number',
        eventTypeId: 'chronicle.event_type_id', eventTypeGeneration: 'chronicle.event_type_generation',
        eventSourceId: 'chronicle.event_source_id', eventCount: 'chronicle.events_count',
        hasEvents: 'chronicle.has_events', eventStreamType: 'chronicle.event_stream_type', eventStreamId: 'chronicle.event_stream_id'
    },
    metrics: {
        eventsAppended: 'chronicle.events.appended', batchAppendsPerformed: 'chronicle.events.batch_appends',
        eventStoreRetrievals: 'chronicle.client.event_store_retrievals', appendDuration: 'chronicle.events.append_duration',
        appendManyDuration: 'chronicle.events.append_many_duration', constraintViolations: 'chronicle.events.constraint_violations',
        appendErrors: 'chronicle.events.append_errors'
    }
};

/** Generates the current public reference with historical old-to-new migration mappings. */
export function telemetryReference(names) {
    const table = (headers, rows) => [
        `| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(row => `| ${row.join(' | ')} |`)
    ].join('\n');
    const quote = value => value ? `\`${value}\`` : '—';
    return [
        '### Span names', '', table(['Operation', 'Removed name', 'Current name'],
            Object.entries(names.spans).map(([key, value]) => [quote(key), quote(removedNames.spans[key]), quote(value)])), '',
        '### Attribute names', '', table(['Concept', 'Removed name', 'Current name'],
            Object.entries(names.attributes).map(([key, value]) => [quote(key), quote(removedNames.attributes[key]), quote(value)])), '',
        '### Metric names', '', table(['Instrument', 'Removed name', 'Current name', 'Previous / current unit'],
            Object.entries(names.metrics).map(([key, value]) => [quote(key), quote(removedNames.metrics[key]), quote(value),
                key.includes('Duration') ? '`ms` / `s`' : quote(({ eventsAppended: '{event}', constraintViolations: '{violation}', appendErrors: '{error}' })[key] ?? '{operation}')]))
    ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { WellKnownTelemetryNames } = await import('../WellKnownTelemetryNames.ts');
    const path = new URL('../../Documentation/observability.md', import.meta.url);
    const current = readFileSync(path, 'utf8');
    const updated = current.replace(/<!-- telemetry-reference:start -->[\s\S]*?<!-- telemetry-reference:end -->/,
        `<!-- telemetry-reference:start -->\n${telemetryReference(WellKnownTelemetryNames)}\n<!-- telemetry-reference:end -->`);
    if (!current.includes('<!-- telemetry-reference:start -->')) throw new Error('Telemetry reference marker missing');
    if (process.argv.includes('--check')) {
        if (updated !== current) throw new Error('Regenerate the telemetry reference with Node.js type stripping: node Source/scripts/telemetry-reference.mjs');
    } else {
        writeFileSync(path, updated);
    }
}
