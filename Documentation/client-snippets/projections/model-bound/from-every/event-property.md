```typescript title="Read a shared event property from every event"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';

enum OrderStateFromEvery {
    New = 'New',
    Confirmed = 'Confirmed',
    Shipped = 'Shipped'
}

@eventType()
export class OrderConfirmedForEvery {
    constructor(readonly status: OrderStateFromEvery) {}
}

@eventType()
export class OrderShippedForEvery {
    constructor(readonly status: OrderStateFromEvery) {}
}

@fromEvent(OrderConfirmedForEvery)
@fromEvent(OrderShippedForEvery)
export class OrderStatusFromEvery {
    @fromEvery('status')
    currentStatus = OrderStateFromEvery.New;
}
```
