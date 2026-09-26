```typescript title="Read a shared event property from every event"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

enum OrderStateFromEvery {
    New = 'New',
    Confirmed = 'Confirmed',
    Shipped = 'Shipped'
}

@eventType()
export class OrderConfirmedForEvery {
    @field(String) readonly status: OrderStateFromEvery;

    constructor(status: OrderStateFromEvery) {
        this.status = status;
    }
}

@eventType()
export class OrderShippedForEvery {
    @field(String) readonly status: OrderStateFromEvery;

    constructor(status: OrderStateFromEvery) {
        this.status = status;
    }
}

@fromEvent(OrderConfirmedForEvery)
@fromEvent(OrderShippedForEvery)
export class OrderStatusFromEvery {
    @fromEvery('status')
    currentStatus = OrderStateFromEvery.New;
}
```
