```typescript
import { eventType, EventSequenceNumber, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GettingStateInventoryAdjusted {
    @field(String) readonly sku: string;
    @field(Number) readonly delta: number;

    constructor(sku: string, delta: number) {
        this.sku = sku;
        this.delta = delta;
    }
}

@eventType()
class GettingStateInventoryReserved {
    @field(String) readonly sku: string;
    @field(Number) readonly quantity: number;

    constructor(sku: string, quantity: number) {
        this.sku = sku;
        this.quantity = quantity;
    }
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
