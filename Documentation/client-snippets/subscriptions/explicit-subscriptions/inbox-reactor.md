```typescript
import { eventType, reactor } from '@cratis/chronicle';

@eventType()
class SubscriptionsExplicitOrderPlaced {
    constructor(
        readonly orderId: string,
        readonly amount: number
    ) {}
}

@reactor()
class SubscriptionsExplicitIncomingOrdersReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async subscriptionsExplicitOrderPlaced(event: SubscriptionsExplicitOrderPlaced): Promise<void> {
        await this.handleIncomingOrder(event.orderId, event.amount);
    }

    private async handleIncomingOrder(orderId: string, amount: number): Promise<void> {}
}
```
