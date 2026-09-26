---
title: Reducers
description: Reducers are documented in the shared Chronicle docs, with TypeScript examples.
sharedTopicBridge: true
---

Reducers are shared Chronicle read-model behavior. Use the shared reducer docs for the model, lifecycle, filtering, and client-tabbed examples.

- [Reducers](/chronicle/reducers/)
- [Getting started with reducers](/chronicle/reducers/getting-started/)
- [Reducer event processing](/chronicle/reducers/event-processing/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

Chronicle calls a reducer method when its name is the camelCase name of the event class, with the event, the current state (`undefined` for the first event), and the event context: `bookBorrowed(event, state, context)` handles `BookBorrowed`. Return the new state. Pass the read-model type as the third argument of `@reducer(id, eventSequenceId, ReadModel)` so the client can register its schema.

By default, the SDK constructs one reducer instance per observation stream. The optional `ChronicleOptions.artifactActivator` also activates reducers: one lease per delivered event batch and separate leases for replay notifications. Its activation context has `kind: ArtifactKind.Reducer`, the owning store/namespace, the partition, event sequence, abort signal, and either the first handled event context or the replay state. `run(callback, invocation)` wraps each handler and receives the current event context and method name (or the replay state for a notification). Existing one-argument `run` implementations still work. `complete()` is awaited once per lease, even after processing fails, before the observation result; a rejected completion fails the partition with `ArtifactCompletionFailed`, retains any processing error, resets the tentative checkpoint, and does not publish tentative read-model state. `dispose()` then runs unconditionally; its errors are only logged. No reducer handler argument changes. State returned by each handler passes to the next handler in the same batch; do not rely on instance fields surviving across batches when using an activator. Reducers should be deterministic during replay: reading mutable external state (including an eventually consistent read model) or appending events from a reducer makes rebuilds unpredictable. Completion failure cannot roll back prior external effects, so make any effects idempotent; see [reactor activation](./reactors.md#activating-artifacts) for the lease contract.
