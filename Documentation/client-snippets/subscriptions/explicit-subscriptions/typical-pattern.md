```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class SubscriptionsExplicitTypicalShipmentDispatched {
    constructor(readonly orderId: string, readonly trackingNumber: string) {}
}

@eventType()
class SubscriptionsExplicitTypicalStockAdjusted {
    constructor(readonly sku: string, readonly delta: number) {}
}

@eventType()
class SubscriptionsExplicitTypicalStockReserved {
    constructor(readonly sku: string, readonly quantity: number) {}
}

async function registerSubscriptionsExplicitTypicalPattern(eventStore: IEventStore): Promise<void> {
    await eventStore.subscriptions.subscribe(
        'orders-from-fulfillment',
        'fulfillment-service',
        builder => builder.withEventType(SubscriptionsExplicitTypicalShipmentDispatched));

    await eventStore.subscriptions.subscribe(
        'inventory-updates',
        'warehouse-service',
        builder => builder
            .withEventType(SubscriptionsExplicitTypicalStockAdjusted)
            .withEventType(SubscriptionsExplicitTypicalStockReserved));
}
```
