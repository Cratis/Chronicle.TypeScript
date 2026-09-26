```typescript
import { eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubscriptionsOutboxInboxOrderPlaced {
    @field(String) readonly orderId: string;

    constructor(orderId: string) {
        this.orderId = orderId;
    }
}

@reactor()
class SubscriptionsOutboxInboxIncomingOrdersReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    @onceOnly()
    async subscriptionsOutboxInboxOrderPlaced(event: SubscriptionsOutboxInboxOrderPlaced): Promise<void> {
        // Handles OrderPlaced events from any subscribed source event store
        await this.process(event.orderId);
    }

    private async process(orderId: string): Promise<void> {}
}
```
