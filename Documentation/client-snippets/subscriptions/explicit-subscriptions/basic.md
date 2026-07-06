```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class SubscriptionsExplicitShipmentDispatched {
    constructor(readonly orderId: string) {}
}

class SubscriptionsExplicitBasic {
    static async run(store: IEventStore): Promise<void> {
        await store.subscriptions.subscribe(
            'orders-from-fulfillment',
            'fulfillment-service',
            builder => builder.withEventType(SubscriptionsExplicitShipmentDispatched)
        );
    }
}
```
