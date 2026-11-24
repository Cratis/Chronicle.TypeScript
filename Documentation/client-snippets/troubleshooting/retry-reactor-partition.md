```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventStore, PartitionRetryOutcome, reactor } from '@cratis/chronicle';

@reactor('customer-notifications')
class FailingNotifications {}

async function retryFirstFailedPartition(eventStore: IEventStore): Promise<void> {
    // The failed partitions of this reactor, in the event store's current namespace.
    const failed = await eventStore.reactors.getFailedPartitionsFor(FailingNotifications);
    if (failed.length === 0) return;

    // The outcome is what Chronicle reports; it is not proof that the partition has recovered.
    const outcome = await eventStore.reactors.retryFailedPartition(FailingNotifications, failed[0].partition);
    switch (outcome) {
        case PartitionRetryOutcome.Accepted:
        case PartitionRetryOutcome.Started:
            // A recovery job was accepted. Read the failed partitions and the reactor state again to see it finish.
            console.log(`Recovery started for partition '${failed[0].partition}'.`);
            break;
        case PartitionRetryOutcome.PartitionNotFound:
            console.log('No failure is recorded for that partition any more.');
            break;
        case PartitionRetryOutcome.ObserverQuarantined:
        case PartitionRetryOutcome.PartitionQuarantined:
            console.log('Chronicle refused the retry until the quarantine is cleared.');
            break;
        default:
            console.log('Chronicle reported an outcome this client does not recognize; do not treat it as success.');
    }
}
```
