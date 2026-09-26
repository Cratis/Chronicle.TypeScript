```typescript
import { onceOnly, reactor } from '@cratis/chronicle';

@reactor('order-notifications')
class NamedOrderNotificationsReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    @onceOnly()
    async reactorOrderPlaced(_event: ReactorOrderPlaced): Promise<void> {
        // Perform the side effect.
    }
}
```
