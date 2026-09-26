```typescript
import { eventType, onceOnly, reactor } from '@cratis/chronicle';

@eventType()
class OnceOnlyOrderPlaced {
    constructor(readonly orderId: string = '') {}
}

@reactor()
class OnceOnlyOrderReactor {
    @onceOnly()
    onceOnlyOrderPlaced(event: OnceOnlyOrderPlaced): void {
        // Notify on live delivery; skip this handler during replay.
    }
}
```
