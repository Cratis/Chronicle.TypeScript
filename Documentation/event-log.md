---
sharedTopicBridge: true
---

# Event Log

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

- `eventLog.redact(sequenceNumber, reason)` and `eventLog.redactForEventSource(eventSourceId, reason, eventTypes?)` permanently rewrite an event's (or an entire event source's) content — a destructive GDPR/compliance erasure, never a field-level mask.
- `eventLog.getForEventSourceIdAndEventTypes(eventSourceId, eventTypes, ...)` and `eventLog.getFromSequenceNumber(sequenceNumber, eventSourceId?, eventTypes?)` read appended events back, filtered by event source and/or event type.
- `eventLog.getNextSequenceNumber()` returns the sequence number the next append will receive (`EventSequenceNumber.first` when the sequence is empty).
- `eventLog.completeStream(eventStreamType, eventStreamId)` permanently closes a non-default stream; further appends to it are rejected with a `StreamClosed` constraint violation.
- `eventLog.appendOperations` is a hot, multicast `AsyncIterable` of every append this event log instance makes, together with its result.
- `appendResult.waitForCompletion(timeoutMs?)` waits for every observer affected by an append to catch up (or fail) before you read a read model back — see [Failed Partitions](./failed-partitions.md).
- The `appendMany(events: EventForEventSourceId[], options?)` overload now applies a distinct `options.concurrencyScopes` entry per event source id in the batch, instead of one shared scope applied to every event source.
