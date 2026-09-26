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

By default, the SDK constructs one reducer instance per observation stream. The optional `ChronicleOptions.artifactActivator` also activates reducers: one lease per delivered event batch, separate leases for replay notifications, `run` around each handler, and awaited `dispose` after the batch. Its context has `kind: ArtifactKind.Reducer`, the owning store/namespace, the partition, event sequence, abort signal, and either the first handled event context or the replay state. No reducer handler argument changes. State returned by each handler passes to the next handler in the same batch; do not rely on instance fields surviving across batches when using an activator. Reducers should be deterministic during replay: reading mutable external state (including an eventually consistent read model) or appending events from a reducer makes rebuilds unpredictable. Cleanup errors are logged without failing the observation result; see [reactor activation](./reactors.md#activating-artifacts) for the lease contract.
