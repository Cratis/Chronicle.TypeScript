---
title: Constraints in the TypeScript client
description: Where constraints are documented, and the TypeScript rules for naming, merging, messages, and releasing constraints declared with decorators.
sharedTopicBridge: true
---

Constraints are shared Chronicle behavior. The shared docs explain the consistency model and show TypeScript examples for each constraint style.

- [Constraints](/chronicle/constraints/)
- [Unique property values with decorators](/chronicle/constraints/model-bound/unique/)
- [Unique event types with decorators](/chronicle/constraints/model-bound/unique-event-type/)
- [TypeScript client setup](./getting-started.md)

## Kernel-free scenario coverage

`EventScenario` and its `ReactorScenario` input use the production constraint compiler. When a scenario selects event types but leaves constraints to default discovery, it compiles the union of globally discovered and selected event constructors (once per constructor), with globally discovered fluent constraints, before keeping definitions referencing a selected event type (including removal events). A selected constructor still contributes its decorators after the discovery registry is cleared. If discovery and selection contain different constructors for the same event type ID and either carries constraint decorators, or a kept definition references an event outside the selected catalog or uses unsupported behavior, the scenario rejects with `UnsupportedEventSequenceOperation` rather than partially simulating it. Constraint-free shadowed IDs use the selected constructor. The pinned-kernel `constraints.json` fixture proves unscoped, case-sensitive unique values for a **single string property** (nonempty ASCII letters and spaces), and one covered unique event type per constraint (decorated or fluent `uniqueFor`). The isolated `constraints-key-domain.json` fixture extends single-property keys to the string and boolean domains below, with a shared definition across event types. It checks same-source reclaims, conflicts across sources and event types, case and whitespace distinctions, default property messages for in-batch and post-reclaim conflicts, configured-message resolution from raw kernel wire violations, and atomic rollback. It proves violation order across different events in a batch, not multiple definitions on the same event; overlapping definitions reject at scenario construction. `constraints-property-lifecycle.json` and `constraints-property-covered-removal.json` additionally prove owner-based replacement and release, two removal event types, a fieldless removal event, and removal events that also claim a key. Include **all** claiming and removal types in the selected catalog; unknown removal names reject instead of silently doing nothing. Leave constraints enabled when testing these behaviors: `new EventScenario({ artifacts: { eventTypes: [Registered] } })`. `constraints-event-type-siblings.json` and `constraints-event-type-cycles.json` prove two unique-event-type removal cycles, each installed as the only definition: two covered types with two removers, and three covered types with three removers where one covered type is also a remover. See [Testing](./testing.md) for the cycle table. `constraints-composite.json` proves fluent composite keys of two and three string properties: the kernel joins the values with `-` in declared order, so `['a-b', 'c']` and `['a', 'b-c']` collide, and a collision reports one violation per property. `constraints-ignore-casing.json` proves fluent `.ignoreCasing()` for string keys in the ASCII key domain: the joined key is lowercased before comparison, and violation details keep the original casing. `constraints-scopes.json` proves all seven scope combinations for case-sensitive single-string property keys, singleton event-type constraints and two-type/two-remover cycles, with one definition installed at a time. Scope-local ownership, replacement/removal, default and custom single/batch routes, case-sensitive matching and atomic rollback are compared through the packaged client and TypeScript protobuf paths. Non-ASCII keys under `ignoreCasing`, unproven scoped, composite or unique-event-type shapes and other unproven definitions reject with `UnsupportedEventSequenceOperation`; use a kernel-backed test. `ReactorScenario` uses the same input boundary, so rejected events do not reach its handlers. See [Testing](./testing.md) for the exact supported boundary and example.

| Unique-property key | In-process support |
| --- | --- |
| Case-sensitive strings | Empty, spaces and padded strings; ASCII letters/digits and `.`, `@`, `_`, `-`, `:`, `\|`, `{`, `}`, `$` (including email-like strings); plus `é` (U+00E9). Spaces are significant. Other valid event-content punctuation is not necessarily a supported constraint key. |
| Schema-backed booleans | `true` and `false` become kernel strings `True` and `False`; boolean `true` conflicts with string `"True"`, not with `"true"`. Violation details retain the kernel spelling. |
| Ownership and release | A successful claim replaces the same source's previous value, releasing the old value to other sources. `@removeConstraint('Name')` or fluent `removedWith(RemovalEvent)` releases **that source's** claim, even if the removal event has no fields; removing an absent claim does nothing. A covered event that also removes must pass uniqueness validation first, then releases instead of saving. |
| Atomic batches | Validation checks the pre-batch index and earlier claims, without releasing property claims mid-batch. `[remove A, B claims A's key]` and `[A replaces its key, B claims A's old key]` still fail and commit nothing. A successful batch of two replacements by A commits both events but only the last value remains owned afterward. Separate successful appends can release and reclaim the old key. |
| Still rejected | Numeric-valued or null/missing keys, unproven punctuation, Unicode or escaped strings, arrays, objects, dates, concepts, schema/value mismatches, non-ASCII or boolean keys under `ignoreCasing`, composites with non-string, repeated or more than three properties, and scoped composites, case-insensitive or boolean keys. Scoped fieldless or covered-and-removal events and scoped definitions alongside other definitions also require a kernel-backed test. |

Non-ASCII keys under `ignoreCasing` stay rejected by design: the scenario maintains no Unicode case mapping, so it never approximates the kernel's lowercasing. Use a kernel-backed test for them.

Fieldless schemas are fixture-backed only for unscoped unique-property removal-only events. These are constrained-key rules, not a relaxation of the scenario's general event-content domain. The oracle captures accepted event content/hashes as well as raw violations and mapped results; failed single and batch operations leave history and the next sequence unchanged.

### Scope matching in scenarios

Use fluent `perEventSourceType()`, `perEventStreamType()` or `perEventStreamId()` before `unique(...)` or `uniqueFor(...)`. Combine them to require all selected dimensions to match. Source ID is the owner or cycle identity, not an additional scope flag. `@unique` is unscoped and cannot merge with a same-named scoped definition; `@removeConstraint` can name a scoped definition.

Direct `EventScenario.append` and both `appendMany` overloads accept routing options. Omitted or empty routes resolve to `Default` / `All` / `Default`, which are exact constraint-scope values, **not** wildcard-like read filters. Route identifiers remain restricted to ASCII letters, digits, `_` and `-`. Property scope keys flatten unescaped dimensions; event-type scopes compare a tuple. Delimiter-alias fixtures are guards, not supported route values. See the [scoped testing example](./testing.md#scoped-constraints-and-append-routing) for per-stream-ID and combined scopes.

Given/when builders, including `ReactorScenario` input, still use default routes. No routed-builder overload is available. A constraint rejection prevents reactor delivery and records no returned effects for the rejected action.

## Concurrent appends

The kernel checks and claims unique values one append at a time per event sequence and namespace, so racing writers cannot both win. This holds whether the appends come from parallel promises on one client or from separate clients:

- When several appends claim the same unique value at the same time, exactly one succeeds. Each of the others returns `isSuccess: false` with one `constraintViolations` entry whose `constraintId` is the constraint name and whose `message` is the configured message.
- An event source may claim its own value again. Only a different event source is rejected.
- A batch from `appendMany` is all or nothing. If any event in it violates a constraint, including two event sources in the same batch claiming one value, no event from the batch is committed.
- Namespaces keep separate constraint indexes, so the same value can be claimed once in each namespace.
- After a removal event releases a value, the next claim succeeds. If several claims race for the released value, exactly one wins.

The kernel-backed specification `when_appending_unique_values_concurrently.integration.spec.ts` checks these guarantees. Run it with `yarn test:integration` from `Source/`, with `CHRONICLE_INTEGRATION_CONNECTION_STRING` set to a running kernel.

## TypeScript client notes

- `@unique(name?, message?)` on an event property prevents another event source from claiming the same value. On an event class, it allows one occurrence of that event type per event source. Without a name, a property constraint uses the property name and a class constraint uses the class name.
- The client merges properties and classes that use the same constraint name into one definition, including across event types. For shared stores across languages and minified bundles, always give constraints explicit, stable names.
- Merged declarations must agree on scope, and decorated properties cannot merge with a case-insensitive fluent constraint. When declarations share a name, the first supplied message wins.
- TypeScript merges same-named unique-event-type declarations across fluent `uniqueFor` constraints and class-level `@unique` decorators. .NET does not: its fluent `Unique<T>(name: ...)` merges only within one `IConstraint`, and same-named class attributes produce separate definitions.
- A message replaces the kernel's default in append results; `{detailKey}` placeholders are replaced from violation details. Fluent `withMessage` messages also appear in append results. Connected and kernel-free scenario append results use the wire `ConstraintName` for `constraintId` so configured messages and their detail substitutions are available in both.
- `@unique` has no ignore-casing option. Use the fluent `@constraint` class with `IConstraintBuilder.unique(...).ignoreCasing()` for case-insensitive matching. Both forms register the same way.
- Put a repeatable `@removeConstraint('Name')` on each event class that releases a constraint. The name must match exactly, one event can release several names, and derived event classes inherit the decorator. It can also release a fluent constraint with the same name.
- For a fluent `unique(...)` property constraint, the registered name is the `@constraint('Name')` id, even if you call `withName('OtherName')`. Use that id in `@removeConstraint`.
- Event classes need `@eventType`, and their modules must be imported or discovered before `getEventStore(...)`. The client registers constraints when it connects, and the kernel enforces them on append.
