---
title: Query behavior patterns
description: Ask what a scope usually does at a moment, or match an explicit context with the TypeScript client.
---

Use `eventStore.patterns` to ask what a person usually does at this point in the
week. Queries use behavior Chronicle has already mined; an empty array means no
established behavior clears the query's thresholds, not a failed request.

This page covers the TypeScript query API. For mining, configuration, and the
meaning of confidence, read [Behavior patterns](/chronicle/patterns/).
The server must support the pattern service, including `UsualActions` (available
in Chronicle 19.26.2).

## Ask about a moment

The examples assume `store` is an `IEventStore` obtained from a
[connected client](connecting.md). The scope is required, normally a user ID.
Omit the moment to ask about now:

```typescript
const patternsNow = await store.patterns.getPatternsAt('user-42');
```

`getPatternsAt` derives `Day` and `TimeBucket` and asks for usual actions. Results
are ranked by confidence, with at most one answer per action. Read the action
from `pattern.facets[FacetName.CommandType]`.

Supply a moment and additional facets to narrow the question:

```typescript
import { FacetName, toDayOfWeek, toTimeBucket } from '@cratis/chronicle';

const mondayMorning = {
    instant: new Date('2026-01-05T09:00:00+02:00'),
    offsetMinutes: 120
};
const invoicePatterns = await store.patterns.getPatternsAt('user-42', mondayMorning, {
    alsoConstraining: { [FacetName.AggregateType]: 'Invoice' }
});
console.log(toDayOfWeek(mondayMorning)); // Monday
console.log(toTimeBucket(mondayMorning)); // Morning
```

To add facets while still using now, pass `undefined` as the second argument.
The moment's derived `Day` and `TimeBucket` override those names in
`alsoConstraining`; other facets are retained. The caller's object is not changed.

## Keep the moment's offset

`PatternMoment` is `{ instant: Date, offsetMinutes: number }`. The offset is
**minutes east of UTC**: `120` means `+02:00`, and `-240` means `-04:00`.
It must be an integer from `-840` to `840` inclusive, matching .NET's
`DateTimeOffset` offset range.

A JavaScript `Date` retains only an instant, even when constructed from an ISO
string containing an offset. Requiring the offset separately makes that lost
information explicit without adding a date library or relying on string parsing
rules. In the example, `instant` is 07:00 UTC, but the query uses 09:00 at `+02:00`.
Do not add the offset to the `Date` yourself.

Omitting the moment captures the current instant and the **local system offset**
(`-instant.getTimezoneOffset()`). On a server that is the server's local offset,
not the user's. Pass an explicit moment when asking about a user elsewhere.
An offset describes this instant only: when scheduling across daylight-saving
changes, obtain the correct offset for the target instant from your time-zone
source. The client does not resolve IANA time zones.

Both `toDayOfWeek(moment)` and `toTimeBucket(moment)` read calendar fields at that
offset, including when it crosses midnight or a week boundary. Days are the
English `DayOfWeek` enum values `Sunday` through `Saturday`, not localized text.
Invalid dates or offsets reject with `RangeError` before a query is sent.

## Time buckets

The exported `toTimeBucket` helper and `getPatternsAt` share one rule, matching
Chronicle's miner. Starts are inclusive; ends are exclusive.

| Local time at the moment's offset | `TimeBucket` |
| --- | --- |
| 05:00–08:00 | `EarlyMorning` |
| 08:00–11:00 | `Morning` |
| 11:00–14:00 | `Midday` |
| 14:00–17:00 | `Afternoon` |
| 17:00–22:00 | `Evening` |
| 22:00–05:00 | `Night` |

For example, exactly 08:00 is `Morning`, and exactly 22:00 is `Night`.

## Query an explicit context

`FacetSet` is a read-only string-to-string record. Use `FacetName` for well-known
names; custom facet names are allowed. `{}` constrains nothing, and empty values
are omitted from queries. Object spread replaces or adds a facet without changing
the original set.

```typescript
import { DayOfWeek, FacetName, TimeBucket, type FacetSet } from '@cratis/chronicle';

const context: FacetSet = {
    [FacetName.Day]: DayOfWeek.Monday,
    [FacetName.TimeBucket]: TimeBucket.Morning
};
const usualActions = await store.patterns.getUsualActions('user-42', context);
const describingPatterns = await store.patterns.getPatterns('user-42', {
    ...context,
    [FacetName.CommandType]: 'RegisterInvoice'
}, { minimumConfidence: 0.8, maximumResults: 10 });
```

`getPatterns` asks whether an already-known action is normal: every facet of a
matching pattern must appear in your context. `getUsualActions` asks what is
usually done: you supply context, and the answer supplies the action.
`getPatternsAt` wraps the latter, not the former.

## API reference

All queries are restricted to the event store and namespace owning `patterns`.
Types and helpers are exported from both `@cratis/chronicle` and
`@cratis/chronicle/patterns`.

| Method | Result |
| --- | --- |
| `getPatterns(scope, context, options?)` | `Promise<BehaviorPattern[]>`, ranked by specificity then confidence |
| `getUsualActions(scope, context, options?)` | `Promise<BehaviorPattern[]>`, ranked by confidence, at most one per action |
| `getPatternsAt(scope, moment?, options?)` | Usual actions at the moment, defaulting to now |
| `getPatternsForScope(scope)` | Every established pattern for the scope, without query limits |
| `getScopes()` | `Promise<string[]>` of grouping keys holding established patterns |

`PatternQueryOptions` provides `minimumConfidence` (0–1) and `maximumResults`
(a result count). Omitting either sends `0`, which selects the server's configured
default. `PatternsAtOptions` also accepts `alsoConstraining?: FacetSet`.

Each `BehaviorPattern` contains `id`, `groupingKey`, `facets`, `confidence`,
`support`, `occurrences`, `weight`, `specificity`, `firstSeen`, and `lastSeen`.
`occurrences` is a `bigint`, preserving the kernel's 64-bit count. Observation
timestamps are `Date` instants, or `undefined` if absent in the response; unlike
`PatternMoment`, these dates do not retain an offset.

Authorization, validation, server, and transport failures reject the promise.
Only a successful query can return an empty answer.
