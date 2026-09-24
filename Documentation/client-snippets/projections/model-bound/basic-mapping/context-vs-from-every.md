```typescript title="Specific context vs every event"
import { eventType, fromEvent, fromEvery, setFromContext } from '@cratis/chronicle';

@eventType()
export class OrderPlacedForLifecycle {
    constructor(readonly customerName: string) {}
}

@eventType()
export class OrderShippedForLifecycle {
    constructor(readonly trackingNumber: string) {}
}

@fromEvent(OrderPlacedForLifecycle)
@fromEvent(OrderShippedForLifecycle)
export class OrderLifecycle {
    @setFromContext(OrderPlacedForLifecycle, 'occurred')
    placedAt = new Date();

    @setFromContext(OrderShippedForLifecycle, 'occurred')
    shippedAt?: Date;

    @fromEvery(undefined, 'occurred')
    lastModified = new Date();
}
```
