```typescript title="Specific context vs every event"
import { eventType, fromEvent, fromEvery, readModel, setFromContext } from '@cratis/chronicle';

@eventType()
class OrderPlacedForLifecycle {
    constructor(readonly customerName: string) {}
}

@eventType()
class OrderShippedForLifecycle {
    constructor(readonly trackingNumber: string) {}
}

@readModel()
@fromEvent(OrderPlacedForLifecycle)
@fromEvent(OrderShippedForLifecycle)
class OrderLifecycle {
    @setFromContext(OrderPlacedForLifecycle, 'occurred')
    placedAt = new Date();

    @setFromContext(OrderShippedForLifecycle, 'occurred')
    shippedAt?: Date;

    @fromEvery(undefined, 'occurred')
    lastModified = new Date();
}
```
