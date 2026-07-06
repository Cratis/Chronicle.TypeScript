```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class SubscriptionsExplicitStockReserved {
    constructor(
        readonly itemId: string,
        readonly quantity: number
    ) {}
}

class SubscriptionsExplicitFiltering {
    static async run(store: IEventStore): Promise<void> {
        await store.subscriptions.subscribe(
            'inventory-updates',
            'warehouse-service',
            builder => builder
                .withEventType(SubscriptionsExplicitStockAdjusted)
                .withEventType(SubscriptionsExplicitStockReserved)
        );
    }
}
```
