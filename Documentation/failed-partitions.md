# Failed Partitions

Chronicle partitions the events an observer (a reactor, reducer, or projection) processes — typically by event source id — so many partitions can make progress independently. When a handler keeps failing for a partition, Chronicle stops retrying it and marks it failed, without blocking any other partition; events already applied to *other* partitions keep flowing. Use `eventStore.failedPartitions` to inspect the partitions an observer has given up on.

## API

`eventStore.failedPartitions` exposes:

- `getAllFailedPartitions()` — every failed partition, across every observer.
- `getFailedPartitionsFor(observerId)` — failed partitions for one specific observer (reactor/reducer) identifier.

Both return a `FailedPartition[]`:

| Property | Description |
| --- | --- |
| `id` | Unique identifier of the failed partition registration. |
| `observerId` | The identifier of the observer (reactor/reducer) the partition failed for. |
| `partition` | The partition key that failed (typically an event source id). |
| `attempts` | Every attempt Chronicle made at processing the partition, oldest first. |

Each `FailedPartitionAttempt` carries:

| Property | Description |
| --- | --- |
| `occurred` | When the attempt happened. |
| `sequenceNumber` | The sequence number being processed at the time of failure. |
| `messages` | Error message(s) captured for the attempt. |
| `stackTrace` | The associated stack trace, if any. |

## Example

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const client = new ChronicleClient(ChronicleOptions.development());
const eventStore = await client.getEventStore('MyStore');

const failedPartitions = await eventStore.failedPartitions.getAllFailedPartitions();
for (const failedPartition of failedPartitions) {
    console.log(`Observer ${failedPartition.observerId} failed partition ${failedPartition.partition}`);
    for (const attempt of failedPartition.attempts) {
        console.log(`  [seq ${attempt.sequenceNumber.value}] ${attempt.messages.join('; ')}`);
    }
}

client.dispose();
```

## Get failed partitions for a specific observer

```typescript
const reactorFailures = await eventStore.failedPartitions.getFailedPartitionsFor('HrNotificationReactor');
```

## Waiting for completion instead of polling

Rather than polling `failedPartitions` after an append, `AppendResult.waitForCompletion()` waits (5 second default timeout) for every observer affected by that specific append to either catch up or fail, and reports any failed partitions directly:

```typescript
const result = await eventStore.eventLog.append('order-123', new OrderShipped());
const completion = await result.waitForCompletion();
if (!completion.isSuccess) {
    for (const failedPartition of completion.failedPartitions) {
        console.log(`Observer ${failedPartition.observerId} failed partition ${failedPartition.partition}`);
    }
}
```

See [Event Log](./event-log.md) for more on `waitForCompletion`.
