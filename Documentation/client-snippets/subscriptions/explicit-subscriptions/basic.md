```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubscriptionsExplicitShipmentDispatched {
    @field(String) readonly orderId: string;

    constructor(orderId: string) {
        this.orderId = orderId;
    }
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
