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
| Root `fromEvent` / `.from()` keyed by `$eventSourceId`, multiple event types and source IDs | Supported for read models with a lowercase `id` schema: string, canonical GUID, or canonical `number/double` identifiers. Missing, `Id`-only, unformatted number, and integer identifier schemas require a kernel-backed test. |
| `setFrom`, schema-based case-insensitive AutoMap, `noAutoMap` | Supported for **scalar targets only** (string, nullable string, boolean, GUID, date-time, number/double, int32/uint32), with matching source type/format, GUID to plain string, int32/uint32 to number/double (including unformatted TypeScript `Number`), and numeric text to int32/uint32/number/double (including unformatted `Number`). Decimal-spelled text is rejected for integer destinations. Date-time mappings accept validated four-digit-year UTC ISO values (no fraction or three-digit milliseconds) in the .NET DateTime range (years 1–9999); other formats and out-of-range values are rejected. Explicit mappings from event properties that differ only by case preserve each exact-case value; ambiguous inferred AutoMap sources are rejected. The event-property paths `true`, `True`, `false`, and `False` are rejected because the kernel resolves them as literals. Other cross-type conversions and object/array target mappings require a kernel-backed test. Mapping `id` (including AutoMap), or a target that collides case-insensitively with another schema property, is rejected. |
| `$eventSourceId`, proven `$eventContext(...)` scalar roots/paths, `$value(...)`, `$null` / scalar clearing | `$eventSourceId` requires a plain string or GUID target; other target types require a kernel-backed test. Fixture-backed context paths have string targets for EventSourceId, EventStore, Namespace, EventSourceType, EventStreamType, EventStreamId, Subject (and `.Value`), Hash, CorrelationId (and `.Value`), CausedBy.Subject/Name/UserName, EventType.Id.Value, and SequenceNumber (and `.Value`); int32 targets for EventType.Generation.Value and Occurred.Year/Month/Day. Subject defaults to the event source ID; omitted Hash is empty and CausedBy uses the kernel's `[Not Set]` identity. Raw Occurred, whole EventType/CausedBy, Causation, Tags, ObservationState, and derived functions require a kernel-backed test. Literal values are supported for the fixture-backed scalar matrix (number/double, int32, uint32, boolean, string, nullable string, and GUID); `$null` clears populated scalar members, including non-nullable number, boolean, GUID, and string. Date-time literals require a kernel-backed test. |
| `$add`, `$subtract`, `$count`, `$increment`, `$decrement` | Rejected in phase 1; zero arithmetic and changeset-presence semantics require a kernel-backed test. |
| Initial projection values; empty mappings; `removedWith`; removal/recreation | Fixture-backed scalar initial values (matching JSON kind, finite numeric range, canonical lowercase GUIDs, or null for nullable strings); initial object, array and date-time values require a kernel-backed test. Each key gets its own initial state, reapplied on recreation; unrelated events do not resurrect a removed model. An event subscribed through both `From` and `RemovedWith` requires a kernel-backed test. |
| Children, nested projections, joins, variants, derivatives, custom/composite/constant keys, dynamic destinations, passive projections, non-default event sequences, subscribe-to-all, `FromEventProperty` | Not supported: use a kernel-backed test. |
| Unsupported numeric formats; incompatible mapping types; multi-generation event-type history; derived context functions; migrations, compliance, scheduling, storage | Not simulated: use a kernel-backed test. |

A subscribed event materializes an identifier-only model even if it changes no mapped properties. Missing content resolves to null but does not add an absent null-valued member; `$null` clears a previously populated member. Public reads omit null fields and apply the kernel's schema defaults (zero, false, empty GUID, and minimum date-time) to missing non-nullable scalar fields; supported non-empty scalar initial state is schema-converted before mappings run; object-shaped initial values are rejected until fixture-backed. The in-memory sink's typed key populates lowercase `id`; phase 1 rejects mappings that write that sink-managed property. A seeded event with the same ID but a different generation from the subscribed event is rejected before replay. Identifiers whose text would canonicalize to a different key (for example `01` as a numeric key or mixed-case GUID text) are rejected to avoid merging distinct sources.

The flat evaluator is checked against committed, per-step fixtures from the pinned production Chronicle projection pipeline (`Source/testing/projections/fixtures/`); `kind: oracleGuard` describes kernel behavior outside the narrowed phase-1 surface (or oracle safety boundaries): the evaluator must reject these fixtures rather than reproduce their kernel snapshots. Failing oracle fixtures also assert the pinned kernel's expected error. Run `yarn oracle:check` to detect drift and use the oracle's update mode only when reviewing changes to the pinned kernel. A green in-process scenario is **not** evidence for persisted reads, observer scheduling, event migrations, compliance encryption, storage conversion, or advanced projection relationships. For broader projections, use ChronicleKernelScenario or a live-kernel test rather than the in-process evaluator.
