```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReducersFilteringOrderPlaced {
    @field(Number) readonly totalAmount: number;

    constructor(totalAmount: number) {
        this.totalAmount = totalAmount;
    }
}

class ReducersFilteringMetadataExampleService {
    constructor(private readonly eventLog: IEventLog) {}

    async placeOrder(orderId: string, totalAmount: number): Promise<void> {
        await this.eventLog.append(orderId, new ReducersFilteringOrderPlaced(totalAmount), {
            tags: ['priority'],
            sourceType: 'order',
            streamType: 'fulfillment'
        });
    }
}
```
