---
title: Failed partitions
description: Find the observer partitions Chronicle stopped retrying, inspect why they failed, and wait for observers to catch up after you append an event.
---

When an accepted append has not produced the expected state or effect, inspect `eventStore.failedPartitions` before sending the event again. Start with `getAllFailedPartitions()` to find the observer and partition involved, then read the attempts' messages, sequence numbers, and stack traces to diagnose the failure.

Chronicle partitions the events an observer (a reactor, reducer, or projection) processes — typically by event source id — so many partitions can make progress independently. When a handler keeps failing for a partition, Chronicle stops retrying it and marks it failed, without blocking any other partition; events already applied to *other* partitions keep flowing. These queries inspect failures in the event store's current namespace. They do not retry the handler or establish that an append was rejected.

## Example

This local-development example lists the failures and their captured messages. Use [TypeScript client setup](./getting-started.md) for the kernel and artifacts; follow [connection security guidance](./connecting.md#secure-the-connection-with-tls) before connecting to a non-local server. In application code, arrange for the client to be disposed even if a query rejects. The later excerpts are separate operations on a live, connected `eventStore`, not code to run after this example disposes its client.

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

Use the observer ID to find its registered handler or projection, and the sequence number to locate the event being processed. A partition failure is about that observer's processing, not every consumer of the event.

## API

`eventStore.failedPartitions` exposes:

- `getAllFailedPartitions()` — every failed partition, across every observer in the current namespace.
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

## Get failed partitions for a specific observer

If you already know which observer is stalled, query its ID directly. `HrNotificationReactor` below is an example identifier; replace it with the registered observer ID, such as one returned by [listing observers](./observers.md).

```typescript
const reactorFailures = await eventStore.failedPartitions.getFailedPartitionsFor('HrNotificationReactor');
```

## Waiting for completion instead of polling

For a script or test that needs to wait after a particular append, inspect the append result first. `AppendResult.waitForCompletion()` waits for every observer affected by an accepted append to catch up or fail. Calling it on an unsuccessful append instead resolves immediately with a successful completion result: there is nothing to wait for. That result does not mean the append succeeded.

This focused excerpt assumes a live, connected `eventStore` and a registered `OrderShipped` event class that can be constructed without arguments. It shows separate decisions for append acceptance, reported observer failures, and a rejected wait; it is not a complete runnable application.

Append diagnostics and wait errors can contain private business data or secrets, including in messages, details, and event source IDs. The attempt messages and stack traces shown earlier carry the same risk. These excerpts do not sanitize those values: sanitize them before logging, restrict access to the logs, and do not copy raw diagnostics into public responses.

```typescript
const result = await eventStore.eventLog.append('order-123', new OrderShipped());
if (!result.isSuccess) {
    console.error('Append failed:', result.constraintViolations, result.concurrencyViolation, result.errors);
} else {
    try {
        const completion = await result.waitForCompletion();
        if (!completion.isSuccess) {
            for (const failedPartition of completion.failedPartitions) {
                console.log(`Observer ${failedPartition.observerId} failed partition ${failedPartition.partition}`);
            }
        } else {
            console.log('Affected observers completed.');
        }
    } catch (error) {
        console.error('Append accepted, but observer completion could not be confirmed:', error);
    }
}
```

The append call can itself reject on prevalidation or transport failure; normal append violations and errors are reported in its result. The `try` above covers only the subsequent wait. Its timeout defaults to 5 seconds. Pass `{ timeoutMs, signal }` to choose a timeout and cancel with the caller. Timeout, cancellation, and RPC failures reject the wait; an observer failure is returned through `completion.failedPartitions` instead. Neither a returned observer failure nor a rejected wait undoes the accepted append. Do not append the event again after a timeout just to try the wait again.

If you read state after successful completion, use [a nullable read](./read-models.md) such as `findInstanceById` and handle `null`: completion does not guarantee a model exists for the key you query.

See [Event Log](./event-log.md) for more on `waitForCompletion`, and [Observers](./observers.md)
for the observer's own state — including removing one whose declaring code is gone, which also
clears any failed partitions kept for it.
