```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class OrderPlaced {
    constructor(
        readonly customerId: string,
        readonly total: number
    ) {}
}

class CheckoutService {
    constructor(private readonly store: IEventStore) {}

    async placeOrder(orderId: string, customerId: string, total: number): Promise<void> {
        const result = await this.store.eventLog.append(
            orderId,
            new OrderPlaced(customerId, total)
        );

        if (!result.isSuccess) {
            // Decide whether to retry or surface a conflict to the caller.
        }
    }
}
```
