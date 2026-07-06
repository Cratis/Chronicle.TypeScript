```typescript
import { eventType, reactor } from '@cratis/chronicle';

@eventType()
class SubscriptionsOutboxInboxOrderPlaced {
    constructor(readonly orderId: string) {}
}

@reactor()
class SubscriptionsOutboxInboxIncomingOrdersReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async subscriptionsOutboxInboxOrderPlaced(event: SubscriptionsOutboxInboxOrderPlaced): Promise<void> {
        // Handles OrderPlaced events from any subscribed source event store
        await this.process(event.orderId);
    }

    private async process(orderId: string): Promise<void> {}
}
```
