```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilteringAppendOrderPlaced {
    @field(String) readonly customerId: string;
    @field(Number) readonly totalAmount: number;

    constructor(customerId: string, totalAmount: number) {
        this.customerId = customerId;
        this.totalAmount = totalAmount;
    }
}

class FilteringAppendService {
    constructor(private readonly eventLog: IEventLog) {}

    async appendOrders(customerId: string): Promise<void> {
        // Appends to observers without a metadata filter.
        await this.eventLog.append('order-standard', new FilteringAppendOrderPlaced(customerId, 42));

        // Also dispatched to observers filtering on the "premium" tag.
        await this.eventLog.append('order-premium', new FilteringAppendOrderPlaced(customerId, 299),
            { tags: ['premium'] });

        // Dispatched to observers filtering on the "wholesale" stream type.
        await this.eventLog.append('order-wholesale', new FilteringAppendOrderPlaced(customerId, 1500),
            { streamType: 'wholesale' });
    }
}
```
