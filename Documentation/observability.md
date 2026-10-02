---
title: Observability reference
description: Configure Chronicle client privacy and logging, propagate trace context, and migrate to convention-only telemetry.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Use this reference to select Chronicle client signals in your observability backend and control what they contain. The client follows the [Cratis OpenTelemetry convention](https://github.com/Cratis/Architecture/blob/main/decisions/0001-opentelemetry-convention.md), with convention-only names after the previous minor's overlap.

## SDK ownership and scope

Both the tracer and meter use `Cratis.Chronicle.Client`, versioned with the installed `@cratis/chronicle` package version. The instrumentation scope already moved from `@cratis/chronicle` in 6.34 without an overlap. This major does not change the scope again. Update backend filters and SDK Views that still select `@cratis/chronicle`. `ChronicleInstrumentationName`, `ChronicleMeterName`, and `WellKnownTelemetryNames.scope` expose the current scope.

Instrumentation is always available. The library depends on `@opentelemetry/api`; it does not install an SDK, exporter, resource, context manager, or propagator. Without an application SDK, tracing and metrics are no-ops. Configure the Node.js SDK in your application's bootstrap, preferably before importing the client, and use standard `OTEL_*` configuration for resources, sampling, and export. The host owns `service.name` and must opt into export; the client sends no telemetry to an endpoint itself.

## Privacy options

Both `ChronicleOptions.fromConnectionString(connectionString, options)` and `ChronicleOptions.development(options)` accept an optional `telemetry: ChronicleTelemetryOptions` object. The settings apply only to that client, including its event log and dynamically created event sequences.

| `telemetry.eventSourceId` | Behavior |
| --- | --- |
| Absent | Omit event source identifiers from span attributes. |
| `{ mode: 'raw' }` | Record the unmodified identifier. Use only when your privacy policy permits it. |
| `{ mode: 'hmac', key: Uint8Array }` | Record a lowercase hexadecimal HMAC-SHA256 using your deployment key. |

Unknown modes and HMAC keys that are not non-empty `Uint8Array` values (including Node.js `Buffer`) are rejected when constructing `ChronicleOptions`.

Keep the HMAC key in your secret store, use a strong random key, and do not log it. Identical identifiers and keys produce identical values; rotating the key changes those values and breaks comparisons with earlier telemetry. Hashing does not make telemetry unrestricted data.

Event source identifiers remain off by default. Opt in explicitly if you need them. The policy affects telemetry only: identifiers sent to Chronicle are unchanged. Multi-source batches do not record identifier arrays, even with opt-in. Metrics never include event source identifiers or correlation identifiers.

Exceptions in spans and diagnostics contain `error.type` and `exception.type`, not exception messages or stacks. Reactor diagnostics exclude event payloads and partition identifiers. Error details required by Chronicle's failure-reporting wire protocol are separate from telemetry and are unchanged.

`cratis.event_sequence.number` is emitted as an integer only when JavaScript can represent it exactly (`Number.isSafeInteger`); larger values are omitted from that attribute. The legacy string attribute `chronicle.sequence_number` is gone. Exact sequence numbers above `Number.MAX_SAFE_INTEGER` are no longer recorded in telemetry, even if an individual value happens to be representable as a JavaScript number. Event sequence APIs continue to return `bigint` values without loss.

## Trace propagation and correlation

The client injects the active OpenTelemetry context into outgoing gRPC metadata using the host's propagator. Configure W3C trace context and baggage in the host. Injection covers unary requests, compatibility checks, keep-alive calls, server and bidirectional streams, authentication retries, and clients rebuilt during reconnect.

Only `cratis.correlation_id` is allowed in baggage. The client replaces stale propagation headers, preserves authorization and unrelated metadata, and leaves the caller's context and metadata unchanged. It does not install a global propagator or fall back to a private trace format.

An explicit append correlation override, or the resolved append correlation, is used consistently on the span and for outgoing baggage. Other operations use the current scoped business correlation when available. Business correlation and trace identifiers remain separate.

Client-owned background work—keep-alive, reactor/reducer observations, re-observation timers, and connection recovery—starts without the initiating caller's trace or business correlation. Foreground calls retain their caller's context. Host gRPC instrumentation can create independent spans for background RPCs.

Stream metadata describes the context when the stream opens, not individual delivered events. Persisting append trace context with events and linking later observer spans require separate kernel support; this client change does not provide those links.

## Application diagnostics

Set the optional `logger: IChronicleLogger` option to route diagnostics to your application's logging pipeline. Its synchronous `log(entry: ChronicleLogEntry): void` method receives one record with:

| Field | Type | Meaning |
| --- | --- | --- |
| `category` | `string` | Component category, retaining the `@cratis/chronicle/` prefix. |
| `level` | `ChronicleLogLevel` | `Verbose`, `Debug`, `Info`, `Warn`, or `Error`. |
| `message` | `string` | Diagnostic description, without serialized exceptions or event payloads. |
| `attributes` | Read-only OpenTelemetry attributes | Safe diagnostic fields; `cratis.correlation_id` when scoped, valid `trace_id`/`span_id` when a trace is active, and numeric `rpc.grpc.status_code` for gRPC failures. Exception messages and stacks are excluded. |

Each client has its own sink. Sink failures do not change RPC results or observation acknowledgements. The host decides how to ingest these records; do not send them through a second logging path too.

When `logger` is absent, `DiagChronicleLogger` forwards sanitized records to OpenTelemetry `diag` for compatibility. Existing `diag.setLogger(...)` configuration still works. The `diag` default is unchanged by this major. See [connection diagnostics](./connecting.md#connection-diagnostics).

## Breaking changes in this major

Each operation produces one `CLIENT` span with a `cratis.chronicle.client.*` name. Legacy `chronicle.*` span names, span attributes, and metric instruments are no longer emitted. Update dashboards, alerts, and SDK Views using the old-to-new tables below before upgrading. The previous overlap minor lets you migrate consumers before losing the old signals.

Remove the former `telemetry.spanNames` option from your configuration; it is no longer part of `ChronicleTelemetryOptions`. For JavaScript callers with leftover configuration, `'convention'` is silently ignored because it is already the only mode. `'legacy'` throws a `TypeError` at options construction with migration guidance. This is only a compatibility check for the removed setting, not a supported naming selector.

Public constants change as follows:

| Previous `WellKnownTelemetryNames` member | Replacement or action |
| --- | --- |
| `spans` with legacy values | `spans` now contains convention names; update span-name queries. |
| `conventionSpans` | Deprecated alias of `spans`; identical values, removed in the next major. |
| `legacyScope` | Removed; use `scope` (`Cratis.Chronicle.Client`, unchanged). |
| `legacyAttributes` | Removed; use `attributes` and migrate attribute filters. |
| `legacyMetrics` | Removed; use `metrics` and migrate instrument selectors and duration thresholds. |

`ChronicleMetrics` now retains only event store, namespace, event sequence, and event type attributes. It drops **every other caller-supplied attribute**, including custom dimensions such as `tenant` and the former batch-size dimension. Remove queries and groupings that depend on those dimensions; record your own instruments if you need custom dimensions.

The integer sequence-number attribute still uses `Number.isSafeInteger`. Removing the legacy string attribute means exact values above `Number.MAX_SAFE_INTEGER` are no longer recorded; use the `bigint` event sequence API when you need those values. The `diag` default logger and event-source-id opt-in policy are unchanged.

Current names below are generated from `WellKnownTelemetryNames`; removed names are historical migration references, not aliases.

<!-- telemetry-reference:start -->
### Span names

| Operation | Removed name | Current name |
| --- | --- | --- |
| `append` | `chronicle.event_sequences.append` | `cratis.chronicle.client.event_sequence.append` |
| `appendMany` | `chronicle.event_sequences.append_many` | `cratis.chronicle.client.event_sequence.append_many` |
| `getTailSequenceNumber` | `chronicle.event_sequences.get_tail_sequence_number` | `cratis.chronicle.client.event_sequence.get_tail_sequence_number` |
| `hasEventsFor` | `chronicle.event_sequences.has_events_for` | `cratis.chronicle.client.event_sequence.has_events_for` |
| `getForEventSourceIdAndEventTypes` | `chronicle.event_sequences.get_for_event_source_id_and_event_types` | `cratis.chronicle.client.event_sequence.get_for_event_source_id_and_event_types` |
| `getFromSequenceNumber` | `chronicle.event_sequences.get_from_sequence_number` | `cratis.chronicle.client.event_sequence.get_from_sequence_number` |
| `redact` | `chronicle.event_sequences.redact` | `cratis.chronicle.client.event_sequence.redact` |
| `redactForEventSource` | `chronicle.event_sequences.redact_for_event_source` | `cratis.chronicle.client.event_sequence.redact_for_event_source` |
| `completeStream` | `chronicle.event_sequences.complete_stream` | `cratis.chronicle.client.event_sequence.complete_stream` |
| `getEventStore` | `chronicle.client.get_event_store` | `cratis.chronicle.client.event_store.get` |
| `getEventStores` | `chronicle.client.get_event_stores` | `cratis.chronicle.client.event_store.list` |
| `getNamespaces` | `chronicle.event_store.get_namespaces` | `cratis.chronicle.client.event_store.get_namespaces` |

### Attribute names

| Concept | Removed name | Current name |
| --- | --- | --- |
| `correlationId` | — | `cratis.correlation_id` |
| `eventStore` | `chronicle.event_store` | `cratis.event_store.name` |
| `namespace` | `chronicle.namespace` | `cratis.event_store.namespace` |
| `eventSequenceId` | `chronicle.event_sequence_id` | `cratis.event_sequence.id` |
| `sequenceNumber` | `chronicle.sequence_number` | `cratis.event_sequence.number` |
| `eventTypeId` | `chronicle.event_type_id` | `cratis.event_type.id` |
| `eventTypeGeneration` | `chronicle.event_type_generation` | `cratis.event_type.generation` |
| `eventSourceType` | — | `cratis.event_source.type` |
| `eventSourceId` | `chronicle.event_source_id` | `cratis.event_source.id` |
| `eventCount` | `chronicle.events_count` | `cratis.event.count` |
| `hasEvents` | `chronicle.has_events` | `cratis.chronicle.event_sequence.has_events` |
| `eventStreamType` | `chronicle.event_stream_type` | `cratis.chronicle.event_stream.type` |
| `eventStreamId` | `chronicle.event_stream_id` | `cratis.chronicle.event_stream.id` |
| `errorType` | — | `error.type` |
| `exceptionType` | — | `exception.type` |

### Metric names

| Instrument | Removed name | Current name | Previous / current unit |
| --- | --- | --- | --- |
| `eventsAppended` | `chronicle.events.appended` | `cratis.chronicle.event_sequence.appended` | `{event}` |
| `batchAppendsPerformed` | `chronicle.events.batch_appends` | `cratis.chronicle.event_sequence.batch_appends` | `{operation}` |
| `eventStoreRetrievals` | `chronicle.client.event_store_retrievals` | `cratis.chronicle.event_store.retrievals` | `{operation}` |
| `appendDuration` | `chronicle.events.append_duration` | `cratis.chronicle.event_sequence.append_duration` | `ms` / `s` |
| `appendManyDuration` | `chronicle.events.append_many_duration` | `cratis.chronicle.event_sequence.append_many_duration` | `ms` / `s` |
| `constraintViolations` | `chronicle.events.constraint_violations` | `cratis.chronicle.event_sequence.constraint_violations` | `{violation}` |
| `appendErrors` | `chronicle.events.append_errors` | `cratis.chronicle.event_sequence.append_errors` | `{error}` |
<!-- telemetry-reference:end -->

`ChronicleMetrics` is deprecated but preserves its existing method signatures and **millisecond duration inputs**. It translates historical input attribute keys, filters dimensions, and records only canonical instruments, converting milliseconds to seconds exactly once. Do not divide durations before passing them to this adapter. To migrate to `ChronicleConventionMetrics`, pass canonical attribute keys and divide millisecond durations by 1,000 yourself; its duration histograms take seconds directly. Do not record both APIs for the same measurement.

Counters retain their existing counting semantics. Duration histograms measure completed append RPCs, including returned rejection results, but not thrown failures. Elapsed time is measured monotonically. Metric dimensions are event store, namespace, event sequence, and event type when known; the batch-size dimension is removed. General cardinality overflow handling is deferred.

### Duration thresholds and histogram buckets

Divide **duration thresholds only** by 1,000 when switching from the legacy millisecond histograms to the convention second histograms. For example, an append latency alert at `250 ms` becomes `0.25 s`. Counter values and count/rate alert thresholds do not change scale.

Both append duration histograms now advise the seconds boundaries below; an SDK View can override them:

| Removed boundaries (`ms`) | Current boundaries (`s`) |
| --- | --- |
| `1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000` | `0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5` |

Update histogram queries and any explicit View boundaries as well as alert thresholds; changing only the instrument name leaves millisecond buckets applied to second-valued measurements.

### Metric dimensions and SDK Views

The convention instruments use these renamed dimensions where available:

| Legacy dimension | Convention dimension |
| --- | --- |
| `chronicle.event_store` | `cratis.event_store.name` |
| `chronicle.namespace` | `cratis.event_store.namespace` |
| `chronicle.event_sequence_id` | `cratis.event_sequence.id` |
| `chronicle.event_type_id` | `cratis.event_type.id` |
| `chronicle.events_count` | Removed from convention metrics; batch size is not a dimension. |

Update groupings, label filters, and View attribute allow-lists. The event count still appears on batch spans as `cratis.event.count`; it is not a replacement metric dimension. Event source and correlation identifiers remain excluded from metrics.

SDK Views select instruments by scope and instrument name. Use scope `Cratis.Chronicle.Client` and change each legacy instrument-name selector to its convention name, with seconds-based duration boundaries. Remove Views that target legacy instruments. A View selecting the old `@cratis/chronicle` scope matches no client instruments.
