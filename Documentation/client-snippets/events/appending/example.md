```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class OrderPlaced {
    @field(String) customerId: string;
    @field(Number) total: number;

    constructor(customerId: string, total: number) {
        this.customerId = customerId;
        this.total = total;
    }
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
