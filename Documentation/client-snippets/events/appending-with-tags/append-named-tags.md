```typescript
import { eventType, IEventStore, NamedTag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class NamedTaggedOrderPlaced {
    @field(Number) readonly total: number;

    constructor(total: number) {
        this.total = total;
    }
}

class NamedTaggedCheckoutService {
    constructor(private readonly store: IEventStore) {}

    async placeOrder(orderId: string, checkoutSessionId: string, total: number): Promise<void> {
        await this.store.eventLog.append(
            orderId,
            new NamedTaggedOrderPlaced(total),
            {
                namedTags: [
                    new NamedTag('checkout-session', checkoutSessionId),
                    new NamedTag('sales-channel', 'web')
                ],
                tags: ['checkout']
            });
    }
}
```
