# Observers

Reactors, reducers, and projections are all observers: something registered against an event
sequence to be told about the events it cares about. `eventStore.observers` is how an application
finds out what the event store knows about its observers, and how it removes one whose declaring
code is gone.

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

## Example

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

## Removing an observer whose declaring code is gone

Deleting a read model and its projection, or removing a reactor, does not remove what it
registered. The observer stays behind, settles into `ObserverRunningState.Disconnected`, and
keeps its definition, state, handled counts, and failed partitions in the event store forever —
until something removes them.

```typescript
const result = await eventStore.observers.remove('HrNotificationReactor');
if (result.isRemoved) {
    console.log('Removed.');
} else {
    console.log(`Refused: ${result.outcome} (${result.blockingNamespace})`);
}
```

Removal covers the whole event store, not just the current namespace: an observer's definition,
and its projection definition where it has one, are store-level records shared by every
namespace. `remove` refuses while the observer is running or still has a subscribed client in
*any* namespace, and `blockingNamespace` names the one that blocked it, since the guard runs
across all of them. **There is no override** — stop the declaring application first if the intent
is to remove a live observer. Read model data and sink containers are left untouched; only the
observer's own bookkeeping goes.
