---
title: Test events, reactors and read models without a kernel
---

# Test events, reactors and read models without a kernel

## EventScenario: fixture-backed appends

`EventScenario` is a scenario-local event sequence for single and batch accepted appends. No kernel, storage, or observers are started. The scenario uses the production constraint compiler, then evaluates only the fixture-backed unscoped subset. For selected event types with default constraint discovery, it compiles globally discovered fluent constraints and the union of globally discovered and selected event constructors (deduplicated by constructor), then keeps definitions referencing a selected event type (as constrained or removal event). Selected decorators still apply when the discovery registry was cleared. Different constructors with the same event type ID reject with `UnsupportedEventSequenceOperation` when either carries constraint decorators; otherwise the selected constructor is used. Incomplete and unsupported definitions also reject rather than being approximated. Supply an isolated event catalog and explicitly disable constraints only when the behavior under test does not depend on them:

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { EventScenario } from '@cratis/chronicle/testing';

class MessageRecorded {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('MessageRecorded')(MessageRecorded);

const scenario = new EventScenario({
    artifacts: { eventTypes: [MessageRecorded] },
    constraints: 'disabled'
});
await scenario.given.forEventSource('message-1').events(new MessageRecorded('seed'));
const result = await scenario.when.forEventSource('message-2').event(new MessageRecorded('act'));
// result.isSuccess === true; scenario.results contains the act-phase result only.
const history = scenario.appendedEvents; // Serialized, independent snapshots of setup and act.
const events = await scenario.eventSequence.getFromSequenceNumber(result.sequenceNumber);
```

For an unscoped unique string property, include the decorated event type in the catalog and leave constraints enabled. Fixture-backed constrained values include digits, punctuation, empty or padded strings, and `é`; a schema-backed boolean is also supported. This is narrower than the kernel's general conversion rules:

```typescript
import { field } from '@cratis/fundamentals';
import { eventType, unique } from '@cratis/chronicle';
import { EventScenario } from '@cratis/chronicle/testing';

class SubscriberRegistered {
    @field(String) @unique('SubscriberEmail', 'Already used: {PropertyValue}') email: string;
    constructor(email: string) { this.email = email; }
}
eventType('SubscriberRegistered')(SubscriberRegistered);

const uniqueScenario = new EventScenario({ artifacts: { eventTypes: [SubscriberRegistered] } });
await uniqueScenario.given.forEventSource('first').events(new SubscriberRegistered('alice'));
const rejected = await uniqueScenario.when.forEventSource('second').event(new SubscriberRegistered('alice'));
// rejected.isSuccess === false; rejected.constraintViolations[0].message === 'Already used: alice'.
```

`scenario.eventLog` is the same sequence when the sequence ID is `event-log`. `scenario.then` is a non-callable assertion view with `results` and `appendedEvents`; use ordinary assertions on it. Direct calls to `scenario.eventSequence.append` and `appendMany` also enter `results`. `given.forEventSource(id).events(...events)` performs sequential **single** appends (including zero events), matching .NET setup; setup results are excluded. The scenario checks every setup event first: if any is rejected, it throws and commits none of that call's events. In .NET, setup ignores each append result, so a rejected event is silently skipped and other events before and after it are still appended. `when.forEventSource(id).event(event)` is the single-event act. In TypeScript, plural `when...events(...)` performs **one atomic batch**, including a one-event call, and returns one result per event. This deliberately differs from .NET's `When.Events`, which appends sequentially and returns one result. Empty batches reject. No append runs projections automatically; `ReadModelScenario` remains independent.

```typescript
const results = await scenario.when.forEventSource('message-2').events(
    new MessageRecorded('first'), new MessageRecorded('second'));
const mixed = await scenario.appendMany([
    { eventSourceId: 'message-1', event: new MessageRecorded('other') },
    { eventSourceId: 'message-2', event: new MessageRecorded('more'), subject: 'message-2' }
]);
// Both calls append atomically, in input order. mixed and results each contain per-event AppendResult values.
```

For the mixed-source overload, per-entry source/stream routing, subject, occurrence and tags override or combine with shared `AppendOptions` as in the production client: the scenario calls production `prepareBatchAppend`. The supported route and subject strings contain only ASCII letters, digits, `_` and `-`; empty values (including an empty per-entry value alongside a shared option) are rejected with `UnsupportedEventSequenceOperation`, not treated as omitted. Tags that JavaScript `trim()` reduces to an empty string are removed by production `mergeTags` before validation. Every other tag must contain only ASCII letters, digits, `_` and `-`; otherwise the append is rejected. Custom GUIDs must be valid. Shared or per-entry occurrence dates must be within UTC years 1–9999. An omitted route resolves to `Default`/`All`/`Default`; a separate batch oracle case sends omitted and empty route fields directly to the pinned kernel to verify that resolution. Read filters support source, type and route combinations within that domain; as the kernel fixture demonstrates, `Default` source type, `All` stream type and `Default` stream ID are non-narrowing filters (not exact-route filters). `appendOperations` is the same hot client-side notification stream as production: subscribe before appending; single appends, including each setup event from `given.events`, publish a one-entry array; `appendMany` and plural `when.events` publish one array with an entry per input event. Notifications carry the client-side input event, not a persisted-event snapshot.

| Operation | Basic EventScenario boundary |
| --- | --- |
| Single and atomic batch append (both overloads), sequential multi-event setup, plural batch action, global zero-based sequence allocation, `hasEventsFor`, next/tail (including type and route filters), source/type/route reads, inclusive reads from sequence (including type filters), append notifications | Supported for registered generation-1 events with flat `@field(String)` and `@field(Boolean)` schemas and matching scalar JSON content; empty schemas are supported only for unique-property removal-only events in the pinned lifecycle fixture. The fixture-backed value domain is booleans and strings containing only printable ASCII (U+0020–U+007E) except `"` and `\`, plus `é` (U+00E9); other strings are rejected with `UnsupportedEventSequenceOperation`. Results include successful appends; accepted history includes setup. |
| Event metadata | Default source/stream routes (`Default`/`All`/`Default`), subject equal to source ID, store `test-event-store`, namespace `default`, correlation, occurrence time (with deterministic scenario clock/ID hooks, UTC years 1–9999 at JavaScript Date millisecond precision), system identity, and a SHA-256/base64 content hash for the supported scalar JSON domain. Fixture-backed batch routing, tags, subject and occurrence metadata are supported with per-entry precedence; single-append custom metadata, concurrency and unproven serialization are rejected. The TypeScript client's append causation preparation is shared with production; kernel fixtures verify Root → TypeScriptClient.Append for single appends and Root → TypeScriptClient.AppendMany (with an event-count property) for batches. The .NET client's default one-entry Unknown chain is different. Stored reads expose the kernel's initial observation state (1). |
| Unscoped constraints | Property-level `@unique` and fluent `unique(...).on(Event, event => event.key)` for one case-sensitive, schema-backed **string or boolean** key per event type, or a fluent composite of two or three string properties, for example `unique(key => key.on(NameRegistered, event => event.first, event => event.last))` (see the composite table below). Fluent `.ignoreCasing()` is supported for string keys in the ASCII key domain (see the case-insensitive table below). The key-domain table below applies to constrained values; it does not widen event content. Class-level `@unique` or fluent `uniqueFor` supports one covered event type per constraint, or one of the two pinned removal-cycle shapes in the table below. Conflicts with accepted history and earlier entries in the same batch reproduce the fixture's violation count and order across events, including default property messages for in-batch conflicts and same-source reclaims, and violation details. A successful same-source replacement frees the old value, and a registered removal event frees that source's value; repeated or wrong-source removals do not free another owner's claim. A covered-and-removal event validates before releasing on commit. During batch validation, neither replacements nor removals release earlier or durable property claims: a batch `[remove A, B claims A's key]` still fails atomically, whereas separate successful appends allow the reclaim. Multiple constraints covering the same event type, a remover covered by another definition, or a remover shared by several definitions are rejected: fixtures do not establish their interaction. Configured `{PropertyName}` and `{PropertyValue}` messages use production substitution. Rejected batches return one failed result per input (sequence number normalized to `0n`), commit nothing, and do not consume sequence numbers; a failed result's `waitForCompletion()` resolves with the SDK's successful no-work value. Setup violations throw and roll back that given call. |
| Empty batches, unresolved removal names, scoped constraints, composite or case-insensitive keys outside the tables below, overlapping validating definitions, unique-event-type shapes outside the cycle table below, migrations, tombstones, alternate generations, protected fields, numeric/date/object content, completion/redaction, transactions, observer-tail and unproven metadata/read filters | **Unsupported:** `UnsupportedEventSequenceOperation` names the operation and artifact and says “Use a kernel-backed test.” Unproven key conversions and event content reject before mutation. Explicit `constraints: 'disabled'` is for scenarios that deliberately do not test constraints; it is never a silent fallback. Accepted single appends cannot wait for observer completion because no observers run. |

| Unique-property key domain | In-process support |
| --- | --- |
| Case-sensitive strings | Empty, one-space and padded strings; ASCII letters/digits, space, `.`, `@`, `_`, `-`, `:`, `\|`, `{`, `}`, `$` (including email-like strings); also U+00E9 (`é`). Other punctuation may be valid *event content* but is not proven as a constrained key. No trimming, Unicode normalization or casing conversion. |
| Schema-backed booleans | `true` hashes as `True`, `false` as `False`. A string `"True"` shares a key with boolean `true`; `"true"` is distinct. Violation details contain `True` or `False`, not JavaScript lowercase spelling. |
| Lifecycle | Each source owns its most recently committed key. A replacement frees its old key; a removal event releases that source's claim even without a value. Whole-batch validation still sees pre-batch claims and earlier batch claims until commit, even when removals/replacements occur before another source's reclaim. |
| Still rejected | Numeric-valued, null/missing, array, object, date, concept or mismatched schema/value keys; unproven punctuation, Unicode, escapes and control characters; scoped definitions. Use a kernel-backed test. |

| Composite unique-property key | In-process support (`constraints-composite.json`) |
| --- | --- |
| Shape | Two or three distinct flat string properties per event type, in fluent `on(Event, ...properties)` order. A shared definition may mix a composite on one event type with a composite in a different property order, or a single string key, on another. |
| Key | The kernel joins each property's string with a literal `-` in **declared** order, not field order, then hashes the result. `['Ada', 'Lovelace']` and `['Lovelace', 'Ada']` are different keys. Empty components still participate, so `['', '']` claims `-`. |
| Delimiter collisions | The joined key is not a tuple. `['a-b', 'c']`, `['a', 'b-c']` and a single key `a-b-c` in the same definition collide, as do `['', 'q-r']` and `['-q', 'r']`. Choose component values that cannot contain `-` if this matters. |
| Violations | One violation per declared property, in declared order, each with that property's own `PropertyName` and `PropertyValue` and the same sequence number; a configured message is resolved separately for each. |
| Lifecycle and batches | Same as single keys: same-source reclaim, replacement and removal of the whole composite claim, and whole-batch validation across event types. Separate definitions never collide with each other. |
| Still rejected | Boolean or other non-string components, repeated property paths (the kernel builds a dictionary keyed by path), more than three properties, nested or indexed paths, and any component value outside the case-sensitive string domain above. Use a kernel-backed test. |

| Case-insensitive unique-property key | In-process support (`constraints-ignore-casing.json`) |
| --- | --- |
| Folding | Fluent `unique(key => key.on(HandleRegistered, event => event.handle).ignoreCasing())`. The kernel lowercases the joined key with .NET `ToLowerInvariant` before hashing; for the ASCII key domain that maps only `A`–`Z` to `a`–`z`. `Alice`, `ALICE` and `alice` collide; digits, spaces and the punctuation listed above are unchanged and still significant (`Alice` and `Alice ` differ). |
| Details and messages | Violation details keep the attempted value's **original** casing (`ALICE`, not `alice`), in configured messages too. |
| Ownership | A source may reclaim its own key with different casing; the violation then reports the latest claim's sequence. Replacement and removal release the folded key. Batches use the same folded key, so `[F: Zed, G: zED]` fails atomically. |
| Composites | Folding applies across the whole joined key, so `['Ab-C', 'd']` and `['ab', 'c-D']` collide; `['AB', 'C-E']` does not. |
| Still rejected | Any non-ASCII character (including `é`, which case-sensitive keys accept), because the pinned fixtures do not establish the kernel's Unicode lowercasing and host JavaScript case tables are not a substitute; boolean keys under `ignoreCasing`; `@unique` merged with a case-insensitive fluent definition (a compiler conflict). Use a kernel-backed test. |

| Unique event type cycle | In-process support |
| --- | --- |
| Definition shapes | Exactly the two pinned shapes, each as the **only** definition in the scenario: two covered types with two separate removers (`constraints-event-type-siblings.json`), or three covered types with three removers where one covered type is also a remover (`constraints-event-type-cycles.json`). Same-named class-level `@unique` or fluent `uniqueFor` declarations compile to one definition; removers use `@removeConstraint('Name')` and must have at least one field. |
| Claims | Per event source, any covered event blocks every covered type until a remover for that source commits. Another source's remover releases nothing. Either remover releases; a remover without an open cycle is accepted. Violations use the definition's message. |
| Covered remover | Validated against the open cycle first: blocked while the cycle is open, otherwise it claims and immediately releases, so a later covered event in the same batch succeeds. A blocked covered remover releases nothing. |
| Atomic batches | A remover earlier in the batch releases the cycle for later events in the batch; a second covered event after an in-batch claim is blocked. A rejected batch commits nothing, including its releases. The raw kernel violation reports the durable holder's sequence number (the first covered event after the source's latest committed remover), or `18446744073709551615` when only an earlier event in the batch holds the cycle. |
| Still rejected | One covered type with removers, several covered types without removers, any other count or overlap of covered and removal types, a cycle definition next to any other definition, fieldless event-type removers and scopes. Use a kernel-backed test. |

The committed `Source/testing/fixtures/*.json` snapshots run through the real in-process kernel via the pinned `Cratis.Chronicle.Testing` 19.8.1 oracle. `yarn oracle:check` verifies them alongside projection fixtures. The fixture tests also compare the TypeScript client’s serialized content, context fields, hash, result shape and essential reads. The boundary fixture covers an empty string, the supported printable ASCII range, a mixed-case property name and exclusion of a different event type on the same source. The source-tail fixture distinguishes the last event for A from the global tail. `batches.json` checks kernel-stored resolved per-entry metadata, the tag merge (including duplicate removal), correlation ID, ordering, hashes, batch causation, read filters and empty-batch rejection. Its .NET client-path oracle resolves per-entry versus shared route, subject and occurrence options **before** sending each event and supplies explicit route defaults; it does not independently prove those precedence rules. Those rules come from production `prepareBatchAppend` shared with the scenario. The separate `batch-omitted-routes.json` fixture bypasses the .NET convenience type and sends genuinely omitted and empty routes through the pinned kernel's batch service, verifying `Default`/`All`/`Default` resolution without claiming client-path notifications. Empty route and subject metadata are outside the scenario's supported domain. `builders.json` proves .NET's sequential setup/action semantics; `batch-rollback.json` proves rejected unique-constraint batches are atomic and leave no sequence gap. `constraints.json` proves string key ownership across event types and sources, ordinal casing and significant spaces, decorated and fluent unique-event-type rejection, raw wire violation fields, default property messages for in-batch conflicts and post-reclaim cross-source conflicts, successful same-source same-key batches with both sequences committed and a subsequent cross-source conflict reporting the last sequence, multiple failures on different events in one batch, and atomic rollback. It does not prove the violation order when one event violates multiple definitions; scenarios reject that overlap. These cases exercise the packaged kernel; the TypeScript spec compares every result and committed-history snapshot to the fixture. `constraints-isolation.json` selects only its declared text definition, and `constraints-key-domain.json` installs a shared string/boolean definition with explicit schemas. Both capture raw kernel violations, mapped results, routes, content, hashes and accepted history after each single or batch operation; failed appends assert unchanged history and sequence. The oracle checks effective installed definitions against fixture order, property names, scope, removal and casing and pins both the sequence and constraint contract descriptors. `constraints-property-lifecycle.json` and `constraints-property-covered-removal.json` separately capture replacement, removal, and batch non-release from pinned kernel storage: raw and mapped violations, every stored hash and history snapshot, and atomic rollback. The removal fixture checks three alternative removers, including a fieldless event; the covered-removal fixture shows validation before release. `constraints-event-type-siblings.json` and `constraints-event-type-cycles.json` each install one unique-event-type definition and capture cycle claims, releases by each remover, other-source removers, repeated removers, a covered remover, in-batch release and reclaim, blocked batches and their rollback, with raw and mapped violations and every stored hash. Composite keys are not inferred from these fixtures; `constraints-composite.json` separately installs a two-property definition shared across three event types (including a reversed declared order and a single key) and a three-property definition, and captures declared-order joining, delimiter collisions, empty components, per-property violations and messages, reclaim, replacement, removal and batch collisions. `constraints-ignore-casing.json` installs a case-insensitive single key with a remover and a case-insensitive composite, and captures ASCII case pairs, punctuation/digit/space significance, case-only same-source reclaim, original-cased details, replacement, removal, batch collisions and folding across component boundaries. Blank or whitespace-padded source filters are rejected until their normalization is fixture-backed. They do not establish production storage, concurrency, compliance or scheduler fidelity; use a kernel-backed test for those behaviors.

## ReactorScenario: live event deliveries and recorded effects

`ReactorScenario` shares the production reactor's handler discovery, per-event invocation boundary and returned-event normalization. Its input is the fixture-bounded `EventScenario`: each `given` or `when` call appends registered events and immediately delivers their serialized history in source-partition order. `given.events` uses sequential single appends; `when.events` uses an atomic batch (including one event). Both await completion before returning. A returned event is **recorded, not appended or recursively delivered**. In production, returning an event type that the same reactor subscribes to delivers it back to the reactor; the scenario does not simulate that feedback loop.

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { reactor } from '@cratis/chronicle/reactors';
import { ReactorScenario } from '@cratis/chronicle/testing';

class WelcomeRequested {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
eventType('WelcomeRequested')(WelcomeRequested);

class WelcomeSent {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
eventType('WelcomeSent')(WelcomeSent);

class WelcomeReactor {
    welcomeRequested(event: WelcomeRequested) { return new WelcomeSent(event.name); }
}
reactor('WelcomeReactor')(WelcomeReactor);

const reactorScenario = new ReactorScenario(WelcomeReactor, {
    artifacts: { eventTypes: [WelcomeRequested, WelcomeSent] },
    constraints: 'disabled'
});
await reactorScenario.given.forEventSource('customer-1').events(new WelcomeRequested('alice'));
await reactorScenario.when.forEventSource('customer-2').events(new WelcomeRequested('bob'));
reactorScenario.shouldHaveProduced(WelcomeSent, sent => sent.name === 'bob');
// reactorScenario.produced contains two events; returned events are not delivered again.
```

`results` contains a delivery outcome per nonempty call: the handled and skipped event contexts, completion status, and any error. `sideEffects` retains each returned event, its target routing, triggering context, handler and delivery index; `produced` flattens the event values. `then` is a non-callable view of all three. A failed delivery records its partial observations and **rejects the awaited call**. It stops on the failing event; the undelivered tail is not included in the outcome. After a delivery failure the whole scenario rejects further deliveries (including to other partitions) before appending, since failed-partition retries and checkpoints are not simulated. Use a kernel-backed test to exercise recovery.

With `artifactActivator`, the scenario activates once per source-partition delivery with the first invocable event context, calls `run` for each handled event **and its returned effects** with `delivery: Events`, that event's context and its method name, calls `complete()` once even after processing failure, then disposes. Both processing and completion failures survive in `ArtifactCompletionFailed`; disposal-only failures are logged. Constructor dependencies belong in this production activator, not a scenario-specific DI container. Without an activator the instance is reused across deliveries, matching the TypeScript runtime (not .NET's fresh-instance default). The third handler argument is production `ReactorServices`; the default scenario store exposes its event log for explicit appends, but unsupported read-model and other store methods reject. Explicit appends are recorded in history but **not delivered to any observer**. An append (including a mixed batch) of an event type this reactor subscribes to rejects before committing, rather than silently skipping its follow-up delivery. An explicit store test double is outside that guard; its behavior is the test's responsibility. Supply `servicesEventStore` as an **explicit test double** for other dependencies. A `resultHandler` follows production semantics: returning true claims the whole result, false falls back to recording, and throwing fails delivery.

The existing committed EventScenario kernel fixtures prove zero-based sequence allocation, serialized context fields and initial observation state for their own event histories: `builders.json` covers sequential setup appends and `batches.json` covers atomic batch actions. Reactor specs exercise contexts from the same EventScenario boundary, not a field-by-field comparison with the fixtures. Grouping one multi-event `given.events` call into one delivery is a scenario convention, not a claim about kernel queue batching. Runtime reactor activation and failure specs exercise the shared dispatcher. This does **not** simulate observer scheduling, retries, checkpoints or distributed ordering. Constraint-bearing reactors use the same selected EventScenario catalog: a rejected append does not deliver to a handler. A rejected `when.events` action throws `ReactorScenario action append failed` with the failed append results (constraint names, resolved messages and errors); a rejected `given.events` setup throws `EventScenario given setup failed` with its failed result. `@filterEventsByTag` reactors reject at construction; `replay()` and `redeliver()` reject with `UnsupportedReactorOperation` until a separate kernel-backed increment. An unsupported service or event-log call inside a handler (including `waitForCompletion()` on an append result) fails the delivery at that event with its `UnsupportedReactorOperation` or `UnsupportedEventSequenceOperation`, even if the handler catches the rejection: nothing is recorded for that event and later events are not delivered. A call is attributed to the delivery whose handler started it, and only while that delivery is running; leftover work from an earlier delivery never fails a later one. `commandTypes` and unknown return shapes likewise reject (commands are not classified in this increment). Returned effects are not validated as kernel appends. Use a kernel-backed test for storage, replay, read-model materialization or command execution.

## ReadModelScenario

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
| `setFrom`, schema-based case-insensitive AutoMap, `noAutoMap` | Supported for **scalar targets only** (string, nullable string, boolean, GUID, date-time, number/double, int32/uint32), with matching source type/format, GUID to plain string, int32/uint32 to number/double (including unformatted TypeScript `Number`), and numeric text to int32/uint32/number/double (including unformatted `Number`). Decimal-spelled text is rejected for integer destinations. Date-time mappings accept validated four-digit-year UTC ISO values (no fraction or three-digit milliseconds) in the .NET DateTime range (years 1–9999); other formats and out-of-range values are rejected. Explicit mappings from event properties that differ only by case preserve each non-null exact-case value; a null exact-case value falls back to the first case-insensitive property in JSON order, which can itself be null. Ambiguous inferred AutoMap sources are rejected. The event-property paths `true`, `True`, `false`, and `False` are rejected because the kernel resolves them as literals. Dotted event-content source paths are not fixture-backed and are rejected. Event string/GUID fields must contain JSON strings. Other cross-type conversions and object/array target mappings require a kernel-backed test. Mapping `id` (including AutoMap), or a target that collides case-insensitively with another schema property, is rejected. |
| `$eventSourceId`, proven `$eventContext(...)` scalar roots/paths, `$value(...)`, `$null` / scalar clearing | `$eventSourceId` requires a plain string or GUID target; other target types require a kernel-backed test. Fixture-backed context paths have string targets for EventSourceId, EventStore, Namespace, EventSourceType, EventStreamType, EventStreamId, Subject (and `.Value`), Hash, CorrelationId (and `.Value`), CausedBy.Subject/Name/UserName, EventType.Id.Value, and SequenceNumber (and `.Value`); int32 targets for EventType.Generation.Value and Occurred.Year/Month/Day. Subject defaults to the event source ID; omitted Hash is empty and CausedBy uses the kernel's `[Not Set]` identity. Raw Occurred, whole EventType/CausedBy, Causation, Tags, ObservationState, and derived functions require a kernel-backed test. Literal values are supported for the fixture-backed scalar matrix (number/double, int32, uint32, boolean, string, nullable string, and GUID); `$null` clears populated scalar members, including non-nullable number, boolean, GUID, and string. Date-time literals require a kernel-backed test. |
| `$add`, `$subtract`, `$count`, `$increment`, `$decrement` | Rejected in phase 1; zero arithmetic and changeset-presence semantics require a kernel-backed test. |
| Initial projection values; empty mappings; `removedWith`; removal/recreation | Fixture-backed scalar initial values (matching JSON kind, finite numeric range, canonical lowercase GUIDs, or null for nullable strings); unmapped array and object schema members are supported with either empty or scalar non-empty initial state (empty state seeds an empty array; non-empty state omits the array; both omit the object). Initial object, array and date-time values require a kernel-backed test. Each key gets its own initial state, reapplied on recreation; unrelated events do not resurrect a removed model. An event subscribed through both `From` and `RemovedWith` requires a kernel-backed test. |
| Children, nested projections, joins, variants, derivatives, custom/composite/constant keys, dynamic destinations, passive projections, non-default event sequences, subscribe-to-all, `FromEventProperty` | Not supported: use a kernel-backed test. |
| Unsupported numeric formats; incompatible mapping types; multi-generation event-type history; derived context functions; migrations, compliance, scheduling, storage | Not simulated: use a kernel-backed test. Compliance/security metadata anywhere in the read-model schema (including id, defaulted, nested, and unmapped members) is rejected before replay. |

A subscribed event materializes an identifier-only model even if it changes no mapped properties. Missing content resolves to null but does not add an absent null-valued member; `$null` clears a previously populated member. Public reads omit null fields and apply the kernel's schema defaults (zero, false, empty GUID, and minimum date-time) to missing non-nullable scalar fields; supported non-empty scalar initial state is schema-converted before mappings run; object-shaped initial values are rejected until fixture-backed. The in-memory sink's typed key populates lowercase `id`; phase 1 rejects mappings that write that sink-managed property. A seeded event with the same ID but a different generation from the subscribed event is rejected before replay. Identifiers whose text would canonicalize to a different key (for example `01` as a numeric key or mixed-case GUID text) are rejected to avoid merging distinct sources.

The flat evaluator is checked against committed, per-step fixtures from the pinned production Chronicle projection pipeline (`Source/testing/projections/fixtures/`); `kind: oracleGuard` describes kernel behavior outside the narrowed phase-1 surface (or oracle safety boundaries): the evaluator must reject these fixtures rather than reproduce their kernel snapshots. Failing oracle fixtures also assert the pinned kernel's expected error. Run `yarn oracle:check` to detect drift and use the oracle's update mode only when reviewing changes to the pinned kernel. A green in-process scenario is **not** evidence for persisted reads, observer scheduling, event migrations, compliance encryption, storage conversion, or advanced projection relationships. For broader projections, use ChronicleKernelScenario or a live-kernel test rather than the in-process evaluator.
