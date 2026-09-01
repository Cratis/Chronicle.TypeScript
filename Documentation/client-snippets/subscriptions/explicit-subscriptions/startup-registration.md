```typescript
import { ChronicleClient, ChronicleOptions, eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class SubscriptionsExplicitStartupShipmentDispatched {
    constructor(readonly orderId: string, readonly trackingNumber: string) {}
}

@eventType()
class SubscriptionsExplicitStartupStockAdjusted {
    constructor(readonly sku: string, readonly delta: number) {}
}

// Safe to call on every application startup
async function runSubscriptionsExplicitStartupRegistration(): Promise<void> {
    const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000'));
    const eventStore: IEventStore = await client.getEventStore('Quickstart');

    await eventStore.subscriptions.subscribe(
        'orders-from-fulfillment',
        'fulfillment-service',
        builder => builder.withEventType(SubscriptionsExplicitStartupShipmentDispatched));

    await eventStore.subscriptions.subscribe(
        'inventory-from-warehouse',
        'warehouse-service',
        builder => builder.withEventType(SubscriptionsExplicitStartupStockAdjusted));
}
```
