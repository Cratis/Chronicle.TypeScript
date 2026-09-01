```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class TaggedOrderPlaced {
    constructor(readonly customerId: string, readonly total: number) {}
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
