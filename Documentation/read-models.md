---
title: Read models
description: Where read models are documented, and how the TypeScript client discovers, identifies, and returns read models.
sharedTopicBridge: true
---

Read models are shared Chronicle concepts. Querying, snapshots, watching, and consistency are documented in the shared Chronicle section.

- [Read models](/chronicle/read-models/)
- [Getting a single read model](/chronicle/read-models/getting-single-instance/)
- [Getting read model collections](/chronicle/read-models/getting-collection-instances/)
- [Watching read models](/chronicle/read-models/watching-read-models/)
- [TypeScript client setup](./getting-started.md)

Read models are discovered from `@projection('id', Model)`, `@reducer('id', sequenceId, Model)`, or an exported model with model-bound event mappings such as `@fromEvent(Event)` and `@setFrom(Event)`. The model type supplies the schema; its class name is the default Chronicle read-model identifier.

Use `@index()` on a read-model field to declare a single ascending, non-unique index. It works on models registered through projections, reducers, and model-bound mappings. The registration includes nested paths such as `lines.productId` when an indexed field belongs to a typed child collection; declare the element type with `@field(Array, { genericArguments: [Line] })`. The read-model key is indexed by the store already. The MongoDB sink creates indexes on registration, including when a container is rebuilt after replay; this does not add a general-purpose query API. See [Indexing read models](/chronicle/read-models/indexing/).

Queries fill every property the model declares from the stored read model. In this client, standard-decorated models whose mappings are only on properties register before construction if their classes are exported by discovered modules. With compiled JavaScript and no discovery patterns, add a class-level `@fromEvent(...)` or explicitly register the class before creating the event store; importing a property-only model alone is not enough. Legacy decorators still register property-only models on import. For unresolved standard mappings, store creation emits a diagnostic warning once per process with the mapped properties and event types grouped by class metadata; see [Artifact discovery](./getting-started.md#artifact-discovery) for registration options and how to enable diagnostic logging.

```typescript
import { field } from '@cratis/fundamentals';
import { eventType, fromEvent } from '@cratis/chronicle';

@eventType('order-placed')
class OrderPlaced {
    @field(Number) total!: number;
}

@fromEvent(OrderPlaced)
export class OrderSummary {
    @field(Number) total!: number;
}
```

## Container names

A read model's container (the MongoDB collection, SQL table, or file the sink writes to) is named by its identifier by default, so `class User` is stored in `User`. To choose another name, pass `readModelNamingPolicy` to `ChronicleOptions`. The policy is called for every read model the client registers, whether it comes from a projection, a reducer, or a model-bound mapping. It receives the read model identifier and, when the client knows it, the read model class, and returns the container name. The class can be missing when the client has only the identifier.

```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createChronicleOptionsReadModelNamingPolicy(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        // Name each read model's container (the MongoDB collection) after its lower-cased class name.
        // The policy gets the read model identifier and, when the client knows it, the read model class.
        readModelNamingPolicy: (identifier, readModelType) => (readModelType?.name ?? identifier).toLowerCase()
    });
}
```

The policy changes only the container name. The identifier and display name registered with the kernel stay as they are, and `.containerName(...)` on a declarative projection still sets the read model's identifier, as it does in the .NET client; the policy then names the container from that identifier. Nothing is applied unless you set the option.

Chronicle and the code that reads the collection must agree on the name. Arc's MongoDB integration reads collections through its own naming policy, which pluralizes the class name by default (`User` is read from `users`), so a projected read model needs a `readModelNamingPolicy` that returns the same name. Arc's policy is configured on Arc's side and is not shared with the Chronicle client; set both so they produce the same name.

For an existing model with a custom identifier, move the identifier to `static readonly readModelId = 'existing-id'` on the model before removing its deprecated `@readModel('existing-id')` decorator. The decorator remains supported for compatibility. Never change the identifier of a model with stored instances unless you plan a data migration. Two different model types with the same identifier fail registration rather than silently overwriting each other.

`store.readModels.getInstanceById(Model, key)` is the canonical read-by-key API, as in the .NET client. Its existing `Promise<Model>` signature does not signal absence: an empty kernel document produces a prototype-only model without populated fields, while a JSON `null` document can produce a model with constructor defaults. The .NET client instead returns `null` for a missing instance; changing this TypeScript behavior would break existing callers. Use `store.readModels.findInstanceById(Model, key)` when you need an explicit `Model | null` result and check for absence before using it. Both methods accept an optional session ID as their third argument.

Projections and reducers run after an append returns, so a read straight after an append can be missing or reflect older state. In scripts and tests, wait with `await appendResult.waitForCompletion()` first. In services, read the [eventual consistency](/chronicle/projections/eventual-consistency/) guidance.

For compliance-bearing reducer reads, both methods reject when PII release fails rather than returning an unreleased instance. Collection reads, snapshots, and watches also reject if compliance release fails.

## Watch readiness and lifetime

If you append before a watch is subscribed, you can miss the change. Keep the object returned by `store.readModels.watch(Model)` and await `watcher.subscribed` before appending. The watch starts immediately, even without iteration. It remains an async iterable: existing `for await (const change of store.readModels.watch(Model))` loops compile unchanged, but transport failures now resume the same watcher instead of ending iteration. See the [watching example](/chronicle/read-models/watching-read-models/) for readiness and cancellation together.

Each change keeps `namespace`, `key`, `readModel`, and `removed`, and adds:

- `changeType`: `ReadModelChangeType.Added`, `Modified`, or `Removed`. Unknown wire kinds map to `Modified`, as in the .NET client.
- `changeContext`: the event store, namespace, triggering `sequenceNumber` as a `bigint`, `correlationId`, and `occurred` as a `Date`. Correlation and occurrence are absent if the kernel omits them; empty or invalid occurrence timestamps are also absent. This is the metadata carried by the watch protocol, not a full `EventContext`: event type, source/stream routing, causation, and identity are not sent. In particular, the model key is not necessarily the event source ID.

Custom implementations and test doubles of `IReadModels.watch` must now return `IReadModelWatcher<T>` rather than a plain async iterable or async generator. Provide a `subscribed` promise that resolves only once observation is active, `onResubscribed(callback)` to register reconnect callbacks and return an unregister function, and an idempotent `dispose()` that releases resources and completes pending iteration. Wrappers can delegate these to the underlying watcher; an in-memory test double may resolve readiness immediately if it is already observing. These members are required so callers can rely on readiness and detect gaps. Existing `for await` consumers and assignments to `AsyncIterable<ReadModelChangeset<T>>` remain source-compatible.

The new changeset fields are optional in the TypeScript interface so existing application-created changesets remain valid. Connected watches populate them from kernel messages; the subscription acknowledgment is never yielded as a change. Check `removed` before reading model properties because a removal can carry an empty document. Kernel 19.26.2 supports projection watches, not server-side reducer watches.

Use one consumer per watcher. `watch(Model, { signal })`, `watcher.dispose()`, an early `for await` exit, and disposing the client all cancel the underlying stream. Disposal is idempotent and completes pending iteration; if readiness is still pending, it rejects with the cancellation reason. A non-transport stream error, deserialization/compliance failure, or terminal client connection failure (such as an incompatible server or rejected credentials) rejects iteration and any pending readiness. Create a new watcher after a terminal watch failure; create a new client after correcting a terminal connection failure.

When the client's connection lifecycle reports a disconnect, a live watcher cancels its old stream. It keeps changes already received, including a conversion in progress, and delivers them in order before changes from the next connection. On reconnect it opens one new stream, continuing the same iterator. `watcher.subscribed` becomes a new pending promise at disconnect if its previous promise had resolved; an already pending promise instead waits for the next successful acknowledgment. Read the property again rather than caching the old promise: a resolved promise cannot become pending again. Transport stream failures (gRPC `CANCELLED`/1, `DEADLINE_EXCEEDED`/4, `INTERNAL`/13, or `UNAVAILABLE`/14) and stream completion also reset readiness without discarding received changes. If the lifecycle stays connected, the watcher retries after one second. Conversion and compliance failures remain terminal even when they carry a transport status.

Register an async refresh callback with `watcher.onResubscribed` before awaiting initial readiness. The callback fires once after each subsequent subscription acknowledgment, not on the first subscription or on a disconnect. Use it to requery with `store.readModels.getInstances(Model)` and replace your displayed collection, including models removed during the outage. The returned function unregisters the callback; disposal unregisters all callbacks. Callbacks run in registration order, and returned promises are awaited before the resumed stream reads further changes. Do not await watch iteration inside a callback. A thrown error or rejected callback promise fails iteration, so an unsuccessful refresh cannot go unnoticed. The [watching example](/chronicle/read-models/watching-read-models/) shows registration and cleanup.

Readiness is a subscription barrier, not a guarantee of uninterrupted connectivity or replay. Watches do not catch up changes missed during an outage. Buffered changes received before the outage are still delivered and may describe older state than your refreshed query; use them as invalidation signals to requery rather than overwriting refreshed state with their model payloads. Do not use watching as a durable event-processing mechanism. The watcher reads independently of the consumer so changes sent before the subscription marker cannot block readiness. It buffers up to 1,024 changes; exceeding that limit fails iteration and pending readiness explicitly rather than silently dropping updates. Consume changes faster, or refresh the model and create a new watcher after an overflow.

`ReactorScenario` rejects `readModels.watch()` immediately with `UnsupportedReactorOperation`, including attempts to await readiness. `ReadModelScenario` does not expose watches. Use a kernel-backed spec to test subscription readiness and change metadata.
