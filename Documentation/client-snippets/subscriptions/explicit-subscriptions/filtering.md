```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubscriptionsExplicitStockReserved {
    @field(String) readonly itemId: string;
    @field(Number) readonly quantity: number;

    constructor(itemId: string, quantity: number) {
        this.itemId = itemId;
        this.quantity = quantity;
    }
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
