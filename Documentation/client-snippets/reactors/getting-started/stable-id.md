```typescript
import { onceOnly, reactor } from '@cratis/chronicle';

@reactor('order-notifications')
class NamedOrderNotificationsReactor {
    // Without @handles(EventType), the method name must be the exact camelCase of the
    // event's class name - Chronicle discovers undecorated handlers by name, not by parameter type.
    @onceOnly()
    async reactorOrderPlaced(_event: ReactorOrderPlaced): Promise<void> {
        // Perform the side effect.
    }
}
```
