```typescript title="Read a shared event property from every event"
import { eventType, fromEvent, fromEvery, readModel } from '@cratis/chronicle';

enum OrderStateFromEvery {
    New = 'New',
    Confirmed = 'Confirmed',
    Shipped = 'Shipped'
}

@eventType()
class OrderConfirmedForEvery {
    constructor(readonly status: OrderStateFromEvery) {}
}

@eventType()
class OrderShippedForEvery {
    constructor(readonly status: OrderStateFromEvery) {}
}

@readModel()
@fromEvent(OrderConfirmedForEvery)
@fromEvent(OrderShippedForEvery)
class OrderStatusFromEvery {
    @fromEvery('status')
    currentStatus = OrderStateFromEvery.New;
}
```
