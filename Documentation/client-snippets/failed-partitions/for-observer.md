```typescript
import { IEventStore } from '@cratis/chronicle';

async function reportFailedPartitionsForObserver(store: IEventStore, observerId: string): Promise<void> {
    const failedPartitions = await store.failedPartitions.getFailedPartitionsFor(observerId);
    for (const failedPartition of failedPartitions) {
        for (const attempt of failedPartition.attempts) {
            console.log(`[seq ${attempt.sequenceNumber.value}] ${attempt.messages.join('; ')}`);
        }
    }
}
```
