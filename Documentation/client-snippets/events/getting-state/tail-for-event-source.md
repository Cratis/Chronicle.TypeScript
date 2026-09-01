```typescript
import { eventType, EventSequenceNumber, IEventLog } from '@cratis/chronicle';

@eventType()
class GettingStateInventoryAdjusted {
    constructor(readonly sku: string, readonly delta: number) {}
}

@eventType()
class GettingStateInventoryReserved {
    constructor(readonly sku: string, readonly quantity: number) {}
}

class GettingStateInventoryCheckpoint {
    constructor(private readonly eventLog: IEventLog) {}

    // Scopes the tail to a specific stream of inventory events.
    captureFor(inventoryId: string): Promise<EventSequenceNumber> {
        return this.eventLog.getTailSequenceNumber(
            inventoryId,
            undefined,
            undefined,
            undefined,
            [GettingStateInventoryAdjusted, GettingStateInventoryReserved]
        );
    }
}
```
