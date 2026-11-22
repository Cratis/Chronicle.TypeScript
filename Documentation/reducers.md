---
title: Reducers
description: Learn where reducers are documented and see TypeScript examples that fold events into read model state, with notes on how they are registered and run.
sharedTopicBridge: true
---

Reducers are shared Chronicle read-model behavior. Use the shared reducer docs for the model, lifecycle, filtering, and client-tabbed examples.

- [Reducers](/chronicle/reducers/)
- [Getting started with reducers](/chronicle/reducers/getting-started/)
- [Reducer event processing](/chronicle/reducers/event-processing/)
- [Reducing events in batches](/chronicle/reducers/batches/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

### Choosing the delivered generation

Compatibility delivery remains the default. On Chronicle kernel **19.41.0 or later**, append `EventGenerationDelivery.Pinned` as the fifth argument: `@reducer('totals', undefined, Totals, true, EventGenerationDelivery.Pinned)`. The preceding ID, event sequence, read model and active flag retain their meanings. See the [self-contained pinned reducer declaration](./client-snippets/reducers/pinned-generation.md).

Pinned delivery requests released, decrypted and migrated content in each subscribed event type's generation during catch-up and replay. Subscribe to one generation per event type; the client uses kernel `Content`, not a `GenerationalContent` entry. See [original and delivered generations](./event-types.md#original-and-delivered-generations). Register the migration chain and required downcasts before observation. `context.eventType.generation` is the delivered generation; `context.appendedGeneration?.value` is the original appended generation, or `undefined` when unknown, including older events. These can differ: generation-2 content downcast for a generation-1 reducer still reports appended generation 2.

Older kernels may ignore the policy; the client does not emulate it or negotiate support. Upgrade before opting in. Existing decorators remain in Compatibility mode, and graph/webhook behavior is unchanged.

Chronicle calls a reducer method when its name is the camelCase name of the event class, with the event, the current state (`undefined` for the first event), and the event context: `bookBorrowed(event, state, context)` handles `BookBorrowed`. To use another method name, decorate it with `@handles(BookBorrowed)` instead. Import `handles` from `@cratis/chronicle` or `@cratis/chronicle/reducers`; both legacy and standard decorators are supported. Explicit declarations use the same [selection and registration rules as reactors](./reactors.md#choosing-a-handler-name): the event constructor must be registered, and each event type has only one handler, whether explicit or conventional. Undecorated helper methods are ignored.

Inherited handlers work, but overriding a method carrying `@handles` requires an explicit `@handles` on the override, even for the same event type. An undecorated override fails registration with `Override '<method>' on '<Derived>' hides @handles(<EventType>) declared on '<Base>'; redecorate the override.` Chronicle also validates methods carrying `@handles` when each reducer instance is created, including instances returned by an activator. Binding the declared method in the constructor is supported; other own properties, including arrow-field overrides, are rejected. Use a method decorated with `@handles` for an override. Conventional handlers retain their existing instance-property behavior. Adding a conventional handler for an event already handled by an inherited method also fails: keep one handler per event type.

Return the new state. Pass the read-model type as the third argument of `@reducer(id, eventSequenceId, ReadModel)` so the client can register its schema.

The reducers collection of the event store offers the same management calls as reactors: `getStateFor`, `replay`, `retryFailedPartition` and `getFailedPartitionsFor`, targeting the reducer's declared event sequence. See [managing a reactor](./reactors.md#managing-a-reactor) for what each result does and does not tell you.

### Pages and batch methods

The client receives pages of event sources and reduces each event source on its own, with up to
`@batchSize({ maxConcurrency })` of them at the same time (the number of processors by default). Per-event methods are
unchanged.

A reducer can instead have exactly **one** batch method: decorate it with `@observes(EventType)` once per event type.
It is called once per event source with `(events: EventBatch, current, context: BatchContext)` and returns the next state,
or `undefined` to remove the read model. Its `@observes` list is the reducer's whole set of event types, so a reducer with
a batch method and per-event methods, or two batch methods, fails registration with
`ReducerMixesBatchAndPerEventMethods`. `events.fail(...)` fails the event source without writing its state, and
`events.defer(..., retryAfterMilliseconds)` delivers it again later. `ReadModelScenario` calls the batch method once per
event source.

### Filtering by event source and stream type

Put `@eventSourceType('customer')` and/or `@eventStreamType('shipping')` on the reducer class to fold only events from those types. Import them from `@cratis/chronicle` or `@cratis/chronicle/events`. Both legacy and standard decorators work, and derived reducers inherit filters unless overridden.

The defaults remain `''` for source type (unspecified) and `'All'` for stream type (unrestricted); explicitly declaring those values removes the corresponding inherited restriction. Source and stream filters combine with `@filterEventsByTag` using **AND**, while multiple filter tags match **any** of the declared tags. Observer labels (`@tag`) do not affect delivery. Set `sourceType` and `streamType` in append options; decorating an event class does not set append metadata. Projections do not support these filters.

`ReadModelScenario` rejects a reducer with non-default source or stream filters using `UnsupportedReducerOperation`. Use a kernel-backed specification to verify filtered state instead of an unfiltered in-process fold.

### Activating reducers

By default, the SDK constructs one reducer instance per observation stream. The optional `ChronicleOptions.artifactActivator` also activates reducers: one lease per delivered event batch and separate leases for replay notifications. Its activation context has `kind: ArtifactKind.Reducer`, the owning store/namespace, the partition, event sequence, abort signal, and either the first handled event context or the replay state. `run(callback, invocation)` wraps each handler and receives the current event context and method name (or the replay state for a notification). Existing one-argument `run` implementations still work. `complete()` is awaited once per lease, even after processing fails, before the observation result; a rejected completion fails the partition with `ArtifactCompletionFailed`, retains any processing error, resets the tentative checkpoint, and does not publish tentative read-model state. `dispose()` then runs unconditionally; its errors are only logged. No reducer handler argument changes. State returned by each handler passes to the next handler in the same batch; do not rely on instance fields surviving across batches when using an activator. Reducers should be deterministic during replay: reading mutable external state (including an eventually consistent read model) or appending events from a reducer makes rebuilds unpredictable. Completion failure cannot roll back prior external effects, so make any effects idempotent; see [reactor activation](./reactors.md#activating-artifacts) for the lease contract.
