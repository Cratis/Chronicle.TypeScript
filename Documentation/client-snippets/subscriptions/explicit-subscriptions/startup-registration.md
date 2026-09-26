```typescript
import { ChronicleClient, ChronicleOptions, eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubscriptionsExplicitStartupShipmentDispatched {
    @field(String) readonly orderId: string;
    @field(String) readonly trackingNumber: string;

    constructor(orderId: string, trackingNumber: string) {
        this.orderId = orderId;
        this.trackingNumber = trackingNumber;
    }
}

@eventType()
class SubscriptionsExplicitStartupStockAdjusted {
    @field(String) readonly sku: string;
    @field(Number) readonly delta: number;

    constructor(sku: string, delta: number) {
        this.sku = sku;
        this.delta = delta;
    }
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
