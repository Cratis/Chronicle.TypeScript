```typescript
import { eventType, handles, ICanBeNotifiedWhenPartitionReplayed, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class PartitionNotifiedOrderPlaced {
    @field(String) readonly orderId: string;

    constructor(orderId: string) {
        this.orderId = orderId;
    }
}

@reactor('partition-notified-orders')
class PartitionNotifiedOrderReactor implements ICanBeNotifiedWhenPartitionReplayed {
    async beginReplayPartition(partition: string): Promise<void> {
        // The partition is the event source id being replayed.
    }

    async endReplayPartition(partition: string): Promise<void> {
    }

    @handles(PartitionNotifiedOrderPlaced)
    async orderPlaced(event: PartitionNotifiedOrderPlaced): Promise<void> {
    }
}
```
