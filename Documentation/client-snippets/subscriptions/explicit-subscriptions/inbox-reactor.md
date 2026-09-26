```typescript
import { eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubscriptionsExplicitOrderPlaced {
    @field(String) readonly orderId: string;
    @field(Number) readonly amount: number;

    constructor(orderId: string, amount: number) {
        this.orderId = orderId;
        this.amount = amount;
    }
}

@reactor()
class SubscriptionsExplicitIncomingOrdersReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    @onceOnly()
    async subscriptionsExplicitOrderPlaced(event: SubscriptionsExplicitOrderPlaced): Promise<void> {
        await this.handleIncomingOrder(event.orderId, event.amount);
    }

    private async handleIncomingOrder(orderId: string, amount: number): Promise<void> {}
}
```
