```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubscriptionsExplicitTypicalShipmentDispatched {
    @field(String) readonly orderId: string;
    @field(String) readonly trackingNumber: string;

    constructor(orderId: string, trackingNumber: string) {
        this.orderId = orderId;
        this.trackingNumber = trackingNumber;
    }
}

@eventType()
class SubscriptionsExplicitTypicalStockAdjusted {
    @field(String) readonly sku: string;
    @field(Number) readonly delta: number;

    constructor(sku: string, delta: number) {
        this.sku = sku;
        this.delta = delta;
    }
}

@eventType()
class SubscriptionsExplicitTypicalStockReserved {
    @field(String) readonly sku: string;
    @field(Number) readonly quantity: number;

    constructor(sku: string, quantity: number) {
        this.sku = sku;
        this.quantity = quantity;
    }
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
