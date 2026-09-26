```typescript
import { eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class OnceOnlyOrderPlaced {
    @field(String) readonly orderId: string;

    constructor(orderId: string = '') {
        this.orderId = orderId;
    }
}

@reactor()
class OnceOnlyOrderReactor {
    @onceOnly()
    onceOnlyOrderPlaced(event: OnceOnlyOrderPlaced): void {
        // Notify on live delivery; skip this handler during replay.
    }
}
```
