```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TaggedOrderPlaced {
    @field(String) readonly customerId: string;
    @field(Number) readonly total: number;

    constructor(customerId: string, total: number) {
        this.customerId = customerId;
        this.total = total;
    }
}

class TaggedCheckoutService {
    constructor(private readonly store: IEventStore) {}

    async placeOrder(orderId: string, customerId: string, total: number): Promise<void> {
        await this.store.eventLog.append(
            orderId,
            new TaggedOrderPlaced(customerId, total),
            { tags: ['checkout', 'priority'] });
    }
}
```
