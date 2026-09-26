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

`scenario.instance` returns the sole materialized model (and rejects ambiguity if more than one exists). For multiple sources use `await scenario.instanceForEventSourceId(id)`; both return `null` when no model exists. A reducer returning `undefined` deletes the model; `await scenario.wasDeletedForEventSourceId(id)` distinguishes this from a model that was never created. A reducer returning `null` instead preserves a null state, which the next handler receives as `null`; the instance accessors still return `null`, but `wasDeletedForEventSourceId(id)` is false. Handlers receive the previous state and an `EventContext`; async handlers are awaited. Event sources are reduced independently, matching kernel partitioning (unlike the .NET testing scenario, which folds all seeded events through one reducer). Events are replayed in seed order, with zero-based sequence numbers assigned globally across sources in that order.

The scenario invokes the same handler selection and dispatch used by the SDK's live reducer observer, but does not simulate kernel storage, observer scheduling, event migrations, compliance, or projections. Projection-backed read models fail with an explicit error; use a kernel-backed test for projections and for behaviors depending on those kernel features.
