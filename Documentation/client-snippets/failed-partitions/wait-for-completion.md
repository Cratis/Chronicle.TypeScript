```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class FailedPartitionsOrderShipped {
    constructor(readonly orderId: string = '') {}
}

async function appendAndCheckFailures(store: IEventStore, orderId: string): Promise<void> {
    const result = await store.eventLog.append(orderId, new FailedPartitionsOrderShipped(orderId));
    const completion = await result.waitForCompletion();

    if (!completion.isSuccess) {
        for (const failedPartition of completion.failedPartitions) {
            console.log(`Observer ${failedPartition.observerId} failed partition ${failedPartition.partition}`);
        }
    }
}
```
