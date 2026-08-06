```typescript
import { IEventStore } from '@cratis/chronicle';

async function reportFailedPartitions(store: IEventStore): Promise<void> {
    const failedPartitions = await store.failedPartitions.getAllFailedPartitions();
    for (const failedPartition of failedPartitions) {
        console.log(`Observer ${failedPartition.observerId} failed partition ${failedPartition.partition}`);
    }
}
```
