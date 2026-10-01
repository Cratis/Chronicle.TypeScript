---
title: Observability reference
description: Configure Chronicle client privacy and logging, propagate trace context, and look up shared and legacy telemetry names.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Use this reference to select Chronicle client signals in your observability backend and control what they contain. The client follows the [Cratis OpenTelemetry convention](https://github.com/Cratis/Architecture/blob/main/decisions/0001-opentelemetry-convention.md), with a minor-release overlap for legacy names.

## SDK ownership and scope

Both the tracer and meter use `Cratis.Chronicle.Client`, versioned with the installed `@cratis/chronicle` package version. Update backend filters that previously selected the `@cratis/chronicle` scope. `ChronicleInstrumentationName` and `ChronicleMeterName` expose the current scope; `WellKnownTelemetryNames.legacyScope` identifies the previous one.

Instrumentation is always available. The library depends on `@opentelemetry/api`; it does not install an SDK, exporter, resource, context manager, or propagator. Without an application SDK, tracing and metrics are no-ops. Configure the Node.js SDK in your application's bootstrap, preferably before importing the client, and use standard `OTEL_*` configuration for resources, sampling, and export. The host owns `service.name` and must opt into export; the client sends no telemetry to an endpoint itself.

## Privacy options

Both `ChronicleOptions.fromConnectionString(connectionString, options)` and `ChronicleOptions.development(options)` accept an optional `telemetry: ChronicleTelemetryOptions` object. The settings apply only to that client, including its event log and dynamically created event sequences.

| `telemetry.eventSourceId` | Behavior |
| --- | --- |
| Absent | Omit event source identifiers from both shared and legacy span attributes. |
| `{ mode: 'raw' }` | Record the unmodified identifier. Use only when your privacy policy permits it. |
| `{ mode: 'hmac', key: Uint8Array }` | Record a lowercase hexadecimal HMAC-SHA256 using your deployment key. |

Keep the HMAC key in your secret store, use a strong random key, and do not log it. Identical identifiers and keys produce identical values; rotating the key changes those values and breaks comparisons with earlier telemetry. Hashing does not make telemetry unrestricted data.

**Upgrade privacy change:** event source identifiers are now off by default, including `chronicle.event_source_id`. Opt in explicitly if you need them. The policy affects telemetry only: identifiers sent to Chronicle are unchanged. Multi-source batches do not record identifier arrays, even with opt-in. Metrics never include event source identifiers or correlation identifiers.

Exceptions in spans and diagnostics contain `error.type` and `exception.type`, not exception messages or stacks. Reactor diagnostics exclude event payloads and partition identifiers. Error details required by Chronicle's failure-reporting wire protocol are separate from telemetry and are unchanged.

Sequence numbers are emitted as integers only when JavaScript can represent them exactly (`Number.isSafeInteger`). Both names are omitted for larger values; event sequence APIs continue to return `bigint` values without loss.

## Trace propagation and correlation

The client injects the active OpenTelemetry context into outgoing gRPC metadata using the host's propagator. Configure W3C trace context and baggage in the host. Injection covers unary requests, compatibility checks, keep-alive calls, server and bidirectional streams, authentication retries, and clients rebuilt during reconnect.

Only `cratis.correlation_id` is allowed in baggage. The client replaces stale propagation headers, preserves authorization and unrelated metadata, and leaves the caller's context and metadata unchanged. It does not install a global propagator or fall back to a private trace format.

An explicit append correlation override, or the resolved append correlation, is used consistently on the span and for outgoing baggage. Other operations use the current scoped business correlation when available. Business correlation and trace identifiers remain separate.

Stream metadata describes the context when the stream opens, not individual delivered events. Persisting append trace context with events and linking later observer spans require separate kernel support; this client change does not provide those links.

## Application diagnostics

Set the optional `logger: IChronicleLogger` option to route diagnostics to your application's logging pipeline. Its synchronous `log(entry: ChronicleLogEntry): void` method receives one record with:

| Field | Type | Meaning |
| --- | --- | --- |
| `category` | `string` | Component category, retaining the `@cratis/chronicle/` prefix. |
| `level` | `ChronicleLogLevel` | `Verbose`, `Debug`, `Info`, `Warn`, or `Error`. |
| `message` | `string` | Diagnostic description, without serialized exceptions or event payloads. |
| `attributes` | Read-only OpenTelemetry attributes | Safe diagnostic fields; `cratis.correlation_id` when scoped, and valid `trace_id`/`span_id` when a trace is active. |

Each client has its own sink. Sink failures do not change RPC results or observation acknowledgements. The host decides how to ingest these records; do not send them through a second logging path too.

When `logger` is absent, `DiagChronicleLogger` forwards sanitized records to OpenTelemetry `diag` for compatibility. Existing `diag.setLogger(...)` configuration still works. This default is retained for the minor-release overlap; its removal belongs to a later major release. See [connection diagnostics](./connecting.md#connection-diagnostics).

## Telemetry names

`WellKnownTelemetryNames` exports the scope, span names, metric names, and attribute keys. The tables below are generated from those constants. Span names remain unchanged in this phase: each operation produces one `CLIENT` span, with shared and legacy attributes on that same span.

<!-- telemetry-reference:start -->
### Span names

| Operation | Name |
| --- | --- |
| `append` | `chronicle.event_sequences.append` |
| `appendMany` | `chronicle.event_sequences.append_many` |
| `getTailSequenceNumber` | `chronicle.event_sequences.get_tail_sequence_number` |
| `hasEventsFor` | `chronicle.event_sequences.has_events_for` |
| `getForEventSourceIdAndEventTypes` | `chronicle.event_sequences.get_for_event_source_id_and_event_types` |
| `getFromSequenceNumber` | `chronicle.event_sequences.get_from_sequence_number` |
| `redact` | `chronicle.event_sequences.redact` |
| `redactForEventSource` | `chronicle.event_sequences.redact_for_event_source` |
| `completeStream` | `chronicle.event_sequences.complete_stream` |
| `getEventStore` | `chronicle.client.get_event_store` |
| `getEventStores` | `chronicle.client.get_event_stores` |
| `getNamespaces` | `chronicle.event_store.get_namespaces` |

### Attribute names

| Concept | Shared name | Legacy name |
| --- | --- | --- |
| `correlationId` | `cratis.correlation_id` | — |
| `eventStore` | `cratis.event_store.name` | `chronicle.event_store` |
| `namespace` | `cratis.event_store.namespace` | `chronicle.namespace` |
| `eventSequenceId` | `cratis.event_sequence.id` | `chronicle.event_sequence_id` |
| `sequenceNumber` | `cratis.event_sequence.number` | `chronicle.sequence_number` |
| `eventTypeId` | `cratis.event_type.id` | `chronicle.event_type_id` |
| `eventTypeGeneration` | `cratis.event_type.generation` | `chronicle.event_type_generation` |
| `eventSourceType` | `cratis.event_source.type` | — |
| `eventSourceId` | `cratis.event_source.id` | `chronicle.event_source_id` |
| `eventCount` | `cratis.event.count` | `chronicle.events_count` |
| `errorType` | `error.type` | — |
| `exceptionType` | `exception.type` | — |
| `hasEvents` | — | `chronicle.has_events` |
| `eventStreamType` | — | `chronicle.event_stream_type` |
| `eventStreamId` | — | `chronicle.event_stream_id` |

### Metric names

| Instrument | Shared name | Legacy name | Shared / legacy unit |
| --- | --- | --- | --- |
| `eventsAppended` | `cratis.chronicle.event_sequence.appended` | `chronicle.events.appended` | `{event}` |
| `batchAppendsPerformed` | `cratis.chronicle.event_sequence.batch_appends` | `chronicle.events.batch_appends` | `{operation}` |
| `eventStoreRetrievals` | `cratis.chronicle.event_store.retrievals` | `chronicle.client.event_store_retrievals` | `{operation}` |
| `appendDuration` | `cratis.chronicle.event_sequence.append_duration` | `chronicle.events.append_duration` | `s` / `ms` |
| `appendManyDuration` | `cratis.chronicle.event_sequence.append_many_duration` | `chronicle.events.append_many_duration` | `s` / `ms` |
| `constraintViolations` | `cratis.chronicle.event_sequence.constraint_violations` | `chronicle.events.constraint_violations` | `{violation}` |
| `appendErrors` | `cratis.chronicle.event_sequence.append_errors` | `chronicle.events.append_errors` | `{error}` |
<!-- telemetry-reference:end -->

`ChronicleMetrics` preserves its existing methods, legacy attributes, and millisecond inputs while also recording the shared-convention instruments. `ChronicleConventionMetrics` exposes the new instruments directly and takes seconds for duration histograms. Do not record both for the same measurement.

Counters retain their existing counting semantics. Duration histograms measure completed append RPCs, including returned rejection results, but not thrown failures. Elapsed time is measured monotonically. New metric dimensions are event store, namespace, event sequence, and event type when known; batch size remains a legacy-only dimension. General cardinality overflow handling is deferred.

The legacy names and the `diag` default are scheduled for a later major release. Span renaming is also deferred. During the overlap, migrate dashboards to the shared attribute and metric names without summing the old and new instruments together.
