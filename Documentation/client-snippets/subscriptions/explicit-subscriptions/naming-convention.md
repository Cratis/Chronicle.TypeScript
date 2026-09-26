```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubscriptionsExplicitStockAdjusted {
    @field(String) readonly itemId: string;
    @field(Number) readonly delta: number;

    constructor(itemId: string, delta: number) {
        this.itemId = itemId;
        this.delta = delta;
    }
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
