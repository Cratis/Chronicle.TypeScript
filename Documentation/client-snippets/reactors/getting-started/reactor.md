```typescript
import { EventContext, reactor } from '@cratis/chronicle';

interface ReactorEmailGateway {
    sendOrderPlaced(email: string, amount: number, occurred: Date): Promise<void>;
}

@reactor()
class OrderNotificationsReactor {
    constructor(private readonly emailGateway: ReactorEmailGateway) {}

    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async reactorOrderPlaced(event: ReactorOrderPlaced, context: EventContext): Promise<void> {
        await this.emailGateway.sendOrderPlaced(
            event.customerEmail,
            event.totalAmount,
            context.occurred);
    }
}
```
