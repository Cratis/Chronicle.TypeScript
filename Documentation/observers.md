# Observers

If an order's event was accepted but its notification or read model has not appeared, start
with `eventStore.observers.getAll()`. Reactors, reducers, and projections are observers registered
against an event sequence. The list shows which observers the store knows about in the current
namespace, their running state, and how far each has progressed. Use the observer ID to connect
that information to the [failed partitions](./failed-partitions.md) for the same observer.

Inspection and removal are different tasks. A stalled or disconnected observer is not necessarily
abandoned, and removing it is not a way to make an append succeed or a read model catch up. Keep
removal for an observer whose declaring code is gone, with the event-store-wide consequences
below understood.

## Example

This local-development example prints each observer's ID, kind, and state. It assumes the
[development setup](./getting-started.md); before using a non-local server, follow the
[connection security guidance](./connecting.md#secure-the-connection-with-tls). In application
code, ensure the client is disposed even when a query rejects. The removal excerpt later on
assumes a live, connected `eventStore`, not this example's already disposed client.

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const client = new ChronicleClient(ChronicleOptions.development());
const eventStore = await client.getEventStore('MyStore');

const observers = await eventStore.observers.getAll();
for (const observer of observers) {
    console.log(`${observer.id} (${observer.type}) is ${observer.runningState}`);
}

client.dispose();
```

Inspect the positions as well as the running state when investigating progress. The state alone
does not tell you whether the particular event you care about has been handled. If the observer
has failed partitions, inspect their messages and sequence numbers before deciding what to do.

## API

`eventStore.observers` exposes:

- `getAll()` — every observer registered in the event store's current namespace.
- `remove(observerId)` — removes an observer and everything keyed to it, returning an
  `ObserverRemovalResult`.

`getAll()` returns an `ObserverInformation[]`:

| Property | Description |
| --- | --- |
| `id` | The identifier of the observer. |
| `eventSequenceId` | The event sequence the observer observes. |
| `type` | What kind of observer this is — `Reactor`, `Projection`, `Reducer`, `External`, or `Unknown`. |
| `runningState` | The state the observer is currently in. |
| `lastHandledEventSequenceNumber` | The position of the last event the observer handled. |
| `nextEventSequenceNumber` | The position of the next event the observer expects to handle. |
| `handledEventCount` | The total number of events the observer has handled. |

## Removing an observer whose declaring code is gone

Deleting a read model and its projection, or removing a reactor, does not remove what it
registered. The observer stays behind, settles into `ObserverRunningState.Disconnected`, and
keeps its definition, state, handled counts, and failed partitions in the event store forever —
until something removes them.

Removal affects every namespace in the event store. A `getAll()` result from the current
namespace is not enough to establish that the observer is unused everywhere. In the excerpt,
`HrNotificationReactor` is the registered ID of the observer intended for removal; substitute
the actual ID only after checking that its declaring code is gone.

```typescript
const result = await eventStore.observers.remove('HrNotificationReactor');
if (result.isRemoved) {
    console.log('Removed.');
} else {
    console.log(`Refused: ${result.outcome} (${result.blockingNamespace})`);
}
```

Read `outcome` as well as `isRemoved`. `Removed` means the observer was removed;
`ObserverNotFound` means there was no registered observer with that ID. `ObserverActive` and
`ObserverSubscribed` are refusals: inspect `blockingNamespace` to find the running observer or
subscribed client. A refusal is not permission to force removal or retry until it succeeds.

Removal covers the whole event store, not just the current namespace: an observer's definition,
and its projection definition where it has one, are store-level records shared by every
namespace. `remove` refuses while the observer is running or still has a subscribed client in
*any* namespace, and `blockingNamespace` names the one that blocked it, since the guard runs
across all of them. **There is no override** — stop the declaring application first if the intent
is to remove a live observer. Read model data and sink containers are left untouched; only the
observer's own bookkeeping goes.
