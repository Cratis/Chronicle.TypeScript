```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReactorsFilteringOrderPlaced {
    @field(Number) readonly totalAmount: number;

    constructor(totalAmount: number) {
        this.totalAmount = totalAmount;
    }
}

class ReactorsFilteringMetadataExampleService {
    constructor(private readonly eventLog: IEventLog) {}

    async placeOrder(orderId: string, totalAmount: number): Promise<void> {
        await this.eventLog.append(orderId, new ReactorsFilteringOrderPlaced(totalAmount), {
            tags: ['priority'],
            sourceType: 'order',
            streamType: 'fulfillment'
        });
    }
}
```
