---
title: Observability reference
description: Configure Chronicle client privacy and logging, propagate trace context, and look up shared and legacy telemetry names.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Use this reference to select Chronicle client signals in your observability backend and control what they contain. The client follows the [Cratis OpenTelemetry convention](https://github.com/Cratis/Architecture/blob/main/decisions/0001-opentelemetry-convention.md), with a minor-release overlap for legacy names.

## SDK ownership and scope

Both the tracer and meter use `Cratis.Chronicle.Client`, versioned with the installed `@cratis/chronicle` package version. The instrumentation scope already moved from `@cratis/chronicle` in 6.34 without an overlap. Neither span naming mode restores the old scope; both metric families also use the new scope. Update backend filters and SDK Views that still select `@cratis/chronicle`. `ChronicleInstrumentationName` and `ChronicleMeterName` expose the current scope; the deprecated `WellKnownTelemetryNames.legacyScope` only identifies the previous one.

Instrumentation is always available. The library depends on `@opentelemetry/api`; it does not install an SDK, exporter, resource, context manager, or propagator. Without an application SDK, tracing and metrics are no-ops. Configure the Node.js SDK in your application's bootstrap, preferably before importing the client, and use standard `OTEL_*` configuration for resources, sampling, and export. The host owns `service.name` and must opt into export; the client sends no telemetry to an endpoint itself.

## Privacy options

Both `ChronicleOptions.fromConnectionString(connectionString, options)` and `ChronicleOptions.development(options)` accept an optional `telemetry: ChronicleTelemetryOptions` object. The settings apply only to that client, including its event log and dynamically created event sequences.

| `telemetry.eventSourceId` | Behavior |
| --- | --- |
| Absent | Omit event source identifiers from both shared and legacy span attributes. |
| `{ mode: 'raw' }` | Record the unmodified identifier. Use only when your privacy policy permits it. |
| `{ mode: 'hmac', key: Uint8Array }` | Record a lowercase hexadecimal HMAC-SHA256 using your deployment key. |

Unknown modes and HMAC keys that are not non-empty `Uint8Array` values (including Node.js `Buffer`) are rejected when constructing `ChronicleOptions`.

Keep the HMAC key in your secret store, use a strong random key, and do not log it. Identical identifiers and keys produce identical values; rotating the key changes those values and breaks comparisons with earlier telemetry. Hashing does not make telemetry unrestricted data.

**Upgrade privacy change:** event source identifiers are now off by default, including `chronicle.event_source_id`. Opt in explicitly if you need them. The policy affects telemetry only: identifiers sent to Chronicle are unchanged. Multi-source batches do not record identifier arrays, even with opt-in. Metrics never include event source identifiers or correlation identifiers.

Exceptions in spans and diagnostics contain `error.type` and `exception.type`, not exception messages or stacks. Reactor diagnostics exclude event payloads and partition identifiers. Error details required by Chronicle's failure-reporting wire protocol are separate from telemetry and are unchanged.

`cratis.event_sequence.number` is emitted as an integer only when JavaScript can represent it exactly (`Number.isSafeInteger`); larger values are omitted from that attribute. The legacy `chronicle.sequence_number` remains a string for every value, including sentinels. Exact sequence numbers above `Number.MAX_SAFE_INTEGER` are available only in that legacy string attribute and will no longer be available in telemetry after the next major removes it. Event sequence APIs continue to return `bigint` values without loss.

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

When `logger` is absent, `DiagChronicleLogger` forwards sanitized records to OpenTelemetry `diag` for compatibility. Existing `diag.setLogger(...)` configuration still works. The `diag` default stays, including in the next major; the telemetry naming migration does not remove it. See [connection diagnostics](./connecting.md#connection-diagnostics).

## Migrating to the convention names

Use this overlap minor to migrate before the next major removes the legacy names. Each operation still produces one `CLIENT` span, not duplicate spans. Both attribute families and both metric families are emitted in either span naming mode.

1. Opt in to convention span names per client with `telemetry.spanNames: 'convention'`. Other clients in the same process keep their own setting.
2. Update dashboards, alerts, and SDK Views using the mappings below. Do not sum the legacy and convention instruments together: they describe the same measurements.
3. Upgrade to the next major after migrating your consumers. It makes convention names the only names, removes legacy attribute and metric emissions, and removes the `spanNames` selector. Remove that option from your configuration at that upgrade.

For example, configure a local development client (the host still owns OpenTelemetry SDK setup):

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const client = new ChronicleClient(ChronicleOptions.development({
    telemetry: { spanNames: 'convention' }
}));
```

The same `telemetry` object works in the second argument of `ChronicleOptions.fromConnectionString`. The optional `spanNames` accepts `'legacy'` (the default) or `'convention'`; any other value is rejected with a `TypeError` when constructing options. It applies to client operations, event stores, event logs, and dynamically created sequences. Scope, privacy policy, correlation, and attribute emission do not depend on the selected mode.

`WellKnownTelemetryNames` exports the scope, span names, metric names, and attribute keys. The following old-to-new mappings are generated from those constants. `spans`, `legacyScope`, `legacyAttributes`, and `legacyMetrics` are deprecated in favor of `conventionSpans`, `scope`, `attributes`, and `metrics`, respectively, ahead of their removal in the next major.

<!-- telemetry-reference:start -->
### Span names

| Operation | Legacy name (default) | Convention name (opt-in) |
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

| Concept | Legacy name | Convention name |
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

| Instrument | Legacy name | Convention name | Legacy / convention unit |
| --- | --- | --- | --- |
| `eventsAppended` | `chronicle.events.appended` | `cratis.chronicle.event_sequence.appended` | `{event}` |
| `batchAppendsPerformed` | `chronicle.events.batch_appends` | `cratis.chronicle.event_sequence.batch_appends` | `{operation}` |
| `eventStoreRetrievals` | `chronicle.client.event_store_retrievals` | `cratis.chronicle.event_store.retrievals` | `{operation}` |
| `appendDuration` | `chronicle.events.append_duration` | `cratis.chronicle.event_sequence.append_duration` | `ms` / `s` |
| `appendManyDuration` | `chronicle.events.append_many_duration` | `cratis.chronicle.event_sequence.append_many_duration` | `ms` / `s` |
| `constraintViolations` | `chronicle.events.constraint_violations` | `cratis.chronicle.event_sequence.constraint_violations` | `{violation}` |
| `appendErrors` | `chronicle.events.append_errors` | `cratis.chronicle.event_sequence.append_errors` | `{error}` |
<!-- telemetry-reference:end -->

`ChronicleMetrics` preserves its existing methods, legacy attributes, and millisecond inputs while also recording the shared-convention instruments. `ChronicleConventionMetrics` exposes the new instruments directly and takes seconds for duration histograms. Do not record both for the same measurement.

Counters retain their existing counting semantics. Duration histograms measure completed append RPCs, including returned rejection results, but not thrown failures. Elapsed time is measured monotonically. New metric dimensions are event store, namespace, event sequence, and event type when known; batch size remains a legacy-only dimension. General cardinality overflow handling is deferred.

### Duration thresholds and histogram buckets

Divide **duration thresholds only** by 1,000 when switching from the legacy millisecond histograms to the convention second histograms. For example, an append latency alert at `250 ms` becomes `0.25 s`. Counter values and count/rate alert thresholds do not change scale.

Both append duration histograms advise these explicit bucket boundaries; an SDK View can override them:

| Legacy boundaries (`ms`) | Convention boundaries (`s`) |
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

SDK Views select instruments by scope and instrument name. Use scope `Cratis.Chronicle.Client` for both families and change each legacy instrument-name selector to its convention name. If you keep separate Views during the overlap, configure millisecond boundaries for legacy durations and second boundaries for convention durations. A View selecting the old `@cratis/chronicle` scope matches neither family.
