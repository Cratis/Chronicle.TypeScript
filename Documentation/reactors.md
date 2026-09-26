---
title: Reactors
description: Where reactors are documented, and how TypeScript reactors return side effects and handle replays.
sharedTopicBridge: true
---

Reactors are documented in the shared Chronicle docs with synchronized examples for C#, Kotlin, Java, Elixir, and TypeScript.

- [Getting started with reactors](/chronicle/reactors/getting-started/)
- [Reactor event processing](/chronicle/reactors/event-processing/)
- [Returning side effects](/chronicle/reactors/side-effects/)
- [OnceOnly](/chronicle/reactors/once-only/)
- [Replay](/chronicle/reactors/replay/)
- [Reactors overview](/chronicle/reactors/)

Use the [TypeScript get started page](/chronicle/clients/typescript/getting-started/) for package installation and connection setup.

## TypeScript client notes

Chronicle calls a reactor method when its name is the camelCase name of the event class: `bookBorrowed(event, context, services)` handles `BookBorrowed`. It does not look at the parameter type, so a method with any other name is never called. The optional third argument, `ReactorServices`, gives the owning observation's `eventStore`, its `readModels` (`services.readModels === services.eventStore.readModels`), and a disconnect/shutdown `signal`. It is the consuming store and namespace, including for imported events, not an application-wide default or the upstream event's provenance. Existing one- and two-argument methods work unchanged; rest-parameter handlers now see this additional argument.

To append explicitly, await `services.eventStore.eventLog.append(context.eventSourceId, event)` and check `result.isSuccess`; a rejected append does not throw automatically. Throw if it failed so the observation is not acknowledged. To read state, use `services.readModels.findInstanceById(Model, context.eventSourceId)` and handle `null`. Read models are eventually consistent: a read may lag the triggering event or be absent, including during replay. There is no automatic historical snapshot at the event's sequence number. If a missing model prevents your side effect, throw rather than acknowledging lost work; make retries safe.

A reactor handler method can return a side effect instead of only observing: a single event, an array of events, a single `EventForEventSourceId` (to target an event source other than the one that triggered the reactor), an array of those, or a mix. Whatever is returned is appended in one atomic `appendMany` call once the handler completes — a bare event uses the triggering event's own event source id, stream, and subject; an `EventForEventSourceId` entry keeps its own target. If the side-effect append fails, the reactor's partition is marked Failed, the same as if the handler itself had thrown.

For application-owned return types, pass `reactorResultHandler` to `ChronicleOptions.fromConnectionString(connectionString, { reactorResultHandler })` (or `development({ reactorResultHandler })`). The callback receives the returned value, triggering `EventContext`, reactor class, event store name, and namespace. Return `true` only after handling the entire result; return `false` to let Chronicle append its recognized event returns. Throw on failure so the partition fails instead of acknowledging a lost side effect. The hook is installed before reactor observations begin. It does not provide a transaction across commands and events; handle mixed returns deliberately.

### Activating artifacts

The SDK normally calls the zero-argument constructor **once per observation stream** and reuses that instance across deliveries and replay notifications. Set `artifactActivator` on `ChronicleOptions.development({ artifactActivator })` (or `fromConnectionString`) to resolve constructor dependencies instead. With an activator, each delivered event batch gets one lease and one shared instance; replay lifecycle notifications get **separate** leases. No lease is made for a message without events or a replay transition. A reconnect creates a new observation, and its context identifies the exact store/namespace and signal for that generation.

```typescript
import { ArtifactDelivery, ArtifactKind, ChronicleOptions, type ClientArtifactsActivator } from '@cratis/chronicle';

const artifactActivator: ClientArtifactsActivator = async (type, context) => {
    // Resolve `type` through your container in a delivery-owned scope here.
    // This simple example works only for classes without constructor dependencies.
    const instance = new type();
    if (context.kind === ArtifactKind.Reactor && context.delivery === ArtifactDelivery.Events) {
        console.log(context.artifactId, context.eventStore.namespace.value, context.eventContext.sequenceNumber);
    }
    return { instance };
};
const options = ChronicleOptions.development({ artifactActivator });
```

The context contains `kind`, `artifactId`, `eventStore`, `readModels`, `eventSequenceId`, `partition`, and `signal`. Its `delivery` discriminant provides `eventContext` (the **first handled** event, not a promise that all events have the same context) or `replayState`. The activator may return `{ instance, dispose, run }`: `run(callback)` optionally enters your scope for **each** handler invocation **and its returned side-effect dispatch**; `dispose()` is awaited once after the batch or notification, even if a handler fails. Only the lease is disposed by the SDK, not a container-owned instance separately. Cleanup errors are logged and do **not** fail acknowledgement; an activator needing cleanup failure to fail delivery must detect it within `run` before acknowledgement. Without an activator, no new ambient metadata/execution boundary is installed. Keep batch-local mutable instance state out of cross-batch assumptions, and stop work cooperatively when `signal` aborts; arbitrary application promises cannot be forcibly canceled.

A `@reactor`/`@reducer`-decorated class instance can also optionally implement `ICanBeNotifiedWhenReplay` (`beginReplay`/`endReplay`) and/or `ICanBeNotifiedWhenPartitionReplayed` (`beginReplayPartition`/`endReplayPartition`, both given the partition) to be notified when a replay begins and ends, at the full-observer or per-partition granularity.

## Replay policies

Reactors are replayable by default. Put `@onceOnly()` on a handler to skip that handler for replayed events, or on the reactor class to register the entire reactor as non-replayable so the kernel does not replay it.

```typescript
import { eventType, reactor, onceOnly, replay } from '@cratis/chronicle';

@eventType()
class OrderPlaced {
    constructor(readonly orderId: string = '') {}
}

@reactor()
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

**Upgrade caution:** Existing reactors now accept kernel replays, including explicit replays and automatic replays such as revision/redaction rewinds or definition-change replays when enabled. Mark side-effecting reactors with class-level `@onceOnly()` if none of their handlers should replay; use method-level `@onceOnly()` when only particular handlers have side effects. Review existing reactors before upgrading to avoid repeating notifications, external calls, or returned events.

`@replay()` uses the `replay<EventClassName>` method naming convention; `@replay(OrderPlaced)` also accepts an explicit event type when a different name is useful. A replay-only handler subscribes to its event type, but does not run during live delivery. Without a replay-specific handler, the ordinary camelCase event handler runs for replayed events unless that method has `@onceOnly()`. When both are present, **only** the replay handler runs during replay; method-level `@onceOnly()` on the ordinary handler does not prevent it. Both decorators support legacy and standard TypeScript decorator syntax.

These policies apply to the **per-event observation state** sent by the kernel, not the separate begin/end replay lifecycle notifications. A message with both a notification and events notifies first, then handles the events; a failed notification fails the partition instead. `@onceOnly()` excludes replay, **not duplicates or retries**. Explicit writes and returned appends are not automatically one transaction with the triggering delivery; make effects idempotent, including under concurrent retries. Replay is not an append sandbox: unguarded explicit or returned writes can happen again during replay.
