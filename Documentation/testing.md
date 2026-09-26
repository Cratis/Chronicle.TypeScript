---
title: Test reducer read models
---

# Test reducer read models without a kernel

Import `ReadModelScenario` from `@cratis/chronicle/testing`. Associate the reducer with its read model using the third argument of `reducer()`. Seed events for an event source, then await the reduced instance:

```typescript
import { eventType, reducer } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

class BookBorrowed {
    constructor(readonly title: string) {}
}
eventType('book-borrowed')(BookBorrowed);

class BookStatus {
    title = '';
}
class BookStatusReducer {
    bookBorrowed(event: BookBorrowed): BookStatus {
        return { title: event.title };
    }
}
reducer('book-status-reducer', undefined, BookStatus)(BookStatusReducer);

const scenario = new ReadModelScenario(BookStatus);
scenario.given.forEventSource('book-42').events(new BookBorrowed('Dune'));
const status = await scenario.instanceForEventSourceId('book-42'); // { title: 'Dune' }
```

This example is also [compiled with the SDK](../Source/testing/ReadModelScenario.example.ts). `scenario.instance` returns the sole materialized model (and rejects ambiguity if more than one exists). For multiple sources use `await scenario.instanceForEventSourceId(id)`; both return `null` when no model exists. `await scenario.wasDeletedForEventSourceId(id)` distinguishes a reducer returning `undefined` to delete a model from a model that was never created. Handlers receive the previous state and an `EventContext`; async handlers are awaited. Events are replayed in seed order, with zero-based sequence numbers.

The scenario invokes the same handler selection and dispatch used by the SDK's live reducer observer, but does not simulate kernel storage, observer scheduling, event migrations, compliance, or projections. Projection-backed read models fail with an explicit error; use a kernel-backed test for projections and for behaviors depending on those kernel features.
