```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FailedPartitionsOrderShipped {
    @field(String) readonly orderId: string;

    constructor(orderId: string = '') {
        this.orderId = orderId;
    }
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
