---
sharedTopicBridge: true
---

# Reactors

Reactors are documented in the shared Chronicle docs with synchronized examples for C#, Kotlin, Java, Elixir, and TypeScript.

- [Getting started with reactors](/chronicle/reactors/getting-started/)
- [Reactor event processing](/chronicle/reactors/event-processing/)
- [Returning side effects](/chronicle/reactors/side-effects/)
- [Replay](/chronicle/reactors/replay/)
- [Reactors overview](/chronicle/reactors/)

Use the [TypeScript get started page](/chronicle/clients/typescript/getting-started/) for package installation and connection setup.

## TypeScript client notes

A reactor handler method can now return a side effect instead of only observing: a single event, an array of events, a single `EventForEventSourceId` (to target an event source other than the one that triggered the reactor), an array of those, or a mix. Whatever is returned is appended in one atomic `appendMany` call once the handler completes — a bare event uses the triggering event's own event source id, stream, and subject; an `EventForEventSourceId` entry keeps its own target. If the side-effect append fails, the reactor's partition is marked Failed, the same as if the handler itself had thrown.

A `@reactor`/`@reducer`-decorated class instance can also optionally implement `ICanBeNotifiedWhenReplay` (`beginReplay`/`endReplay`) and/or `ICanBeNotifiedWhenPartitionReplayed` (`beginReplayPartition`/`endReplayPartition`, both given the partition) to be notified when a replay begins and ends, at the full-observer or per-partition granularity.
