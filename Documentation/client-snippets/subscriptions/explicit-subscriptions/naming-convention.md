```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class SubscriptionsExplicitStockAdjusted {
    constructor(
        readonly itemId: string,
        readonly delta: number
    ) {}
}

class SubscriptionsExplicitNamingConvention {
    static async run(store: IEventStore): Promise<void> {
        // subscription-id format: {target}-from-{source}
        await store.subscriptions.subscribe(
            'orders-from-fulfillment',
            'fulfillment-service',
            builder => builder.withEventType(SubscriptionsExplicitShipmentDispatched)
        );

        await store.subscriptions.subscribe(
            'inventory-from-warehouse',
            'warehouse-service',
            builder => builder.withEventType(SubscriptionsExplicitStockAdjusted)
        );
    }
}
```
