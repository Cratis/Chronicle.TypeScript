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
