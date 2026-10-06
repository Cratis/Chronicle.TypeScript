---
title: Event log
description: Where the event log is documented, and TypeScript-specific notes on appending, reading, redacting, and waiting for observers.
sharedTopicBridge: true
---

The event log is Chronicle's primary event sequence and is documented in the shared Chronicle docs.

- [Events and event logs](/chronicle/events/)
- [Appending events](/chronicle/events/appending/)
- [Appending many events](/chronicle/events/appending-many/)
- [Optimistic concurrency](/chronicle/events/concurrency/)
- [Getting events](/chronicle/events/getting-events/)
- [Observing appends](/chronicle/events/observing-appends/)
- [Event redaction](/chronicle/events/redaction/)
- [Closing streams](/chronicle/closing-streams/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

- An append without route options leaves the route to the kernel. Clients before this change sent a `Default` route themselves, so existing streams need attention; follow [Preserve existing append routes](./migrate-append-routing.md) before upgrading.
- `append` and `appendMany` do not throw on a constraint violation, concurrency violation, or append error. `append` returns one `AppendResult`; `appendMany` returns an array with one per event. Check `isSuccess` on each result, or read `constraintViolations`, `concurrencyViolation`, and `errors`.
- `AppendOptions` accepts `sourceType`, `streamType`, `streamId`, `subject`, `occurred`, `correlationId`, `tags`, `namedTags`, `concurrencyScope`, and `concurrencyScopes`. Rich batch entries override shared metadata; concurrency scopes remain independent.
- Structured named tags are `NamedTag` values: a nonblank name and an exact, possibly empty, value. Pass them as `namedTags` on `AppendOptions` (shared by every event) or on an `EventForEventSourceId` entry (that event only). Each event gets its own tags first, then the shared ones, keeping the first occurrence of each exact name and value pair. An invalid tag throws `InvalidNamedTag` before anything is sent. An append that carries named tags uses the kernel's dedicated named-tag call, so a kernel without named-tag support rejects it instead of dropping the tags. Read them back from `context.namedTags` on read and delivered events.
- Batches cannot combine non-empty named tags with any registered `eventSource` entry, even when the tags and registered source belong to different events. The client throws `NamedTagsWithRegisteredEventSourceNotSupported` before any RPC because the kernel's named-tag batch operation drops registered source routing ([kernel issue](https://github.com/Cratis/Chronicle/issues/4603)). Single `append` calls support this combination; batches with an empty `namedTags` array or without registered sources are unaffected.
- `eventLog.redact(sequenceNumber, reason)` and `eventLog.redactForEventSource(eventSourceId, reason, eventTypes?)` permanently rewrite an event's (or an entire event source's) content — a destructive GDPR/compliance erasure, never a field-level mask.
- `eventLog.getForEventSourceIdAndEventTypes(eventSourceId, eventTypes, ...)` and `eventLog.getFromSequenceNumber(sequenceNumber, eventSourceId?, eventTypes?)` read appended events back, filtered by event source and/or event type.
- Route arguments on `getForEventSourceIdAndEventTypes` and `getTailSequenceNumber` do not default to the legacy `Default` route. An omitted dimension does not narrow the read, so it also returns the events the kernel routed for an append with no route options. Pass the dimensions explicitly to scope a read to one stream; see [Preserve existing append routes](./migrate-append-routing.md).
- `eventLog.getNextSequenceNumber()` returns the sequence number the next append will receive (`EventSequenceNumber.first` when the sequence is empty).
- `eventLog.completeStream(eventStreamType, eventStreamId)` permanently closes a non-default stream; further appends to it are rejected with a `StreamClosed` constraint violation.
- `eventLog.appendOperations` is a hot, multicast `AsyncIterable` of every append this event log instance makes, together with its result.
- `appendResult.waitForCompletion(timeoutMs?)` waits for every observer affected by an append to catch up or fail before you read a read model back. Pass `{ timeoutMs?, signal? }` instead to cancel the underlying wait RPC when the caller aborts; the signal and timeout are combined so either cancels it. It resolves immediately for an unsuccessful append and rejects when the timeout (5 seconds by default) or caller cancellation occurs. See [Failed Partitions](./failed-partitions.md).
- `appendMany(events: EventForEventSourceId[], options?)` sends every `options.concurrencyScopes` label, including labels that are not append targets. A target without an explicit entry uses the shared `concurrencyScope` option. The kernel requires at least one event per batch; a scope-only batch is rejected.
- Use `EventSequenceNumber.beforeFirst.value` as `sequenceNumber` when a scope must assert that no matching event exists. It is sent as the wire `ExpectsNoMatchingEvent` flag, not as a sequence number; `EventSequenceNumber.unset.value` means no expected revision. On a kernel that does not support the flag, the check is skipped, so verify server compatibility before relying on this for a first append.
