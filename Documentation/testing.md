---
title: Test read models without a kernel
---

# Test read models without a kernel

Import `ReadModelScenario` from `@cratis/chronicle/testing`. Associate a reducer with its read model using the third argument of `reducer()`. Seed events for an event source, then await the instance:

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

`scenario.instance` returns the sole materialized model (and rejects ambiguity if more than one exists). For multiple sources use `await scenario.instanceForEventSourceId(id)`; both return `null` when no model exists. `await scenario.wasDeletedForEventSourceId(id)` distinguishes a removed model from one never created. Events replay in seed order, with zero-based sequence numbers assigned globally across sources. Adding seeds after a read replays the complete history. When a reducer and a projection both apply, the reducer takes precedence: its handlers receive previous state and `EventContext`, async handlers are awaited, `undefined` deletes the model, and `null` preserves a null state for the next handler.

## Projection capabilities

Without a reducer, `ReadModelScenario` compiles the same model-bound or declarative projection contract used by registration and validates the **whole definition before replay**. Supply all participating event types in the optional artifact catalog if you isolate discovery. For a declarative projection without an explicit read-model type, also supply the production read-model catalog (`readModels`) so association is inferred against the same candidates; without it the scenario does not link that projection. An unsupported mapping fails even if you never seed its event. A read model cannot have multiple applicable projections.

| Capability | In-process scenario |
| --- | --- |
| Root `fromEvent` / `.from()` keyed by `$eventSourceId`, multiple event types and source IDs | Supported; string, canonical GUID, and canonical number/int32/uint32 identifiers |
| `setFrom`, schema-based case-insensitive AutoMap, `noAutoMap`, ordinary object/array values | Supported; explicit mappings take precedence, aggregate-only handlers do not infer mappings |
| `$eventSourceId`, supported `$eventContext(...)` scalar roots/paths, `$value(...)`, `$null` / scalar clearing | Supported for schema-compatible scalar values and declared content paths; raw `$eventContext(Occurred)` is rejected because the kernel converts it inconsistently |
| `$add`, `$subtract`, `$count`, `$increment`, `$decrement` | Finite number/double and int32/uint32; out-of-range or noncanonical values fail rather than silently round |
| Initial projection values; empty mappings; `removedWith`; removal/recreation | Supported; each key gets its own initial state, reapplied on recreation; unrelated events do not resurrect a removed model |
| Children, nested projections, joins, variants, derivatives, custom/composite/constant keys, dynamic destinations, passive projections, non-default event sequences, subscribe-to-all, `FromEventProperty` | Not supported: use a kernel-backed test |
| float, decimal, duration, int64 arithmetic; double operands into integer targets; multi-generation event types; derived context functions; migrations, compliance, scheduling, storage | Not simulated: use a kernel-backed test |

A subscribed event materializes an identifier-only model even if it changes no mapped properties. Missing content resolves to null but does not add an absent null-valued member; `$null` clears a previously populated member. Public reads omit null fields and apply the kernel's schema defaults (zero, false, empty GUID, and minimum date-time) to missing non-nullable scalar fields; non-empty initial state is schema-converted before mappings run. Identifiers whose text would canonicalize to a different key (for example `01` as a numeric key or mixed-case GUID text) are rejected to avoid merging distinct sources.

The flat evaluator is checked against committed, per-step fixtures from the pinned production Chronicle projection pipeline (`Source/testing/projections/fixtures/`); `kind: oracleGuard` describes oracle safety boundaries and is not an evaluator expectation. Run `yarn oracle:check` to detect drift and use the oracle's update mode only when reviewing changes to the pinned kernel. A green in-process scenario is **not** evidence for persisted reads, observer scheduling, event migrations, compliance encryption, storage conversion, or advanced projection relationships. For these behaviors, exercise the real Chronicle kernel in a kernel-backed test.
