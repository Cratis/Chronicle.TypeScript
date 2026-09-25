---
sharedTopicBridge: true
---

# Reactors

Reactors are documented in the shared Chronicle docs with synchronized examples for C#, Kotlin, Java, Elixir, and TypeScript.

- [Getting started with reactors](/chronicle/reactors/getting-started/)
- [Reactor event processing](/chronicle/reactors/event-processing/)
- [Returning side effects](/chronicle/reactors/side-effects/)
- [OnceOnly](/chronicle/reactors/once-only/)
- [Replay](/chronicle/reactors/replay/)
- [Reactors overview](/chronicle/reactors/)

Use the [TypeScript get started page](/chronicle/clients/typescript/getting-started/) for package installation and connection setup.

## TypeScript client notes

A reactor handler method can now return a side effect instead of only observing: a single event, an array of events, a single `EventForEventSourceId` (to target an event source other than the one that triggered the reactor), an array of those, or a mix. Whatever is returned is appended in one atomic `appendMany` call once the handler completes — a bare event uses the triggering event's own event source id, stream, and subject; an `EventForEventSourceId` entry keeps its own target. If the side-effect append fails, the reactor's partition is marked Failed, the same as if the handler itself had thrown.

For application-owned return types, pass `reactorResultHandler` to `ChronicleOptions.fromConnectionString(connectionString, { reactorResultHandler })` (or `development({ reactorResultHandler })`). The callback receives the returned value, triggering `EventContext`, reactor class, event store name, and namespace. Return `true` only after handling the entire result; return `false` to let Chronicle append its recognized event returns. Throw on failure so the partition fails instead of acknowledging a lost side effect. The hook is installed before reactor observations begin. It does not provide a transaction across commands and events; handle mixed returns deliberately.

A `@reactor`/`@reducer`-decorated class instance can also optionally implement `ICanBeNotifiedWhenReplay` (`beginReplay`/`endReplay`) and/or `ICanBeNotifiedWhenPartitionReplayed` (`beginReplayPartition`/`endReplayPartition`, both given the partition) to be notified when a replay begins and ends, at the full-observer or per-partition granularity.

## Replay policies

Unlike the .NET client (which registers reactors as replayable unless the class has `[OnceOnly]`), **TypeScript reactors remain non-replayable by default** for compatibility with existing applications. Add `@replayable()` to opt a class into kernel replays. A class-level `@onceOnly()` overrides this opt-in: the kernel never replays that reactor.

```typescript
import { reactor, replayable, onceOnly, replay } from '@cratis/chronicle/reactors';
import { eventType } from '@cratis/chronicle/events';

@eventType()
class OrderPlaced {
    constructor(readonly orderId: string = '') {}
}

@reactor()
@replayable()
class OrderReactor {
    @onceOnly()
    async orderPlaced(event: OrderPlaced): Promise<void> {
        // Notify the customer on live delivery; never notify again during replay.
    }

    @replay()
    async replayOrderPlaced(event: OrderPlaced): Promise<void> {
        // Rebuild replay-specific state instead of running orderPlaced.
    }
}
```

`@replay()` uses the `replay<EventClassName>` method naming convention; `@replay(OrderPlaced)` also accepts an explicit event type when a different name is useful. A replay-only handler subscribes to its event type, but does not run during live delivery. Without a replay-specific handler, the ordinary camelCase event handler runs for replayed events unless that method has `@onceOnly()`. When both are present, **only** the replay handler runs during replay; method-level `@onceOnly()` on the ordinary handler does not prevent it. Both decorators support legacy and standard TypeScript decorator syntax.

These policies apply to the **per-event observation state** sent by the kernel, not the separate begin/end replay lifecycle notifications. They do not guarantee exactly-once delivery: failed-partition recovery delivers ordinary events again, so side effects still need idempotency.
