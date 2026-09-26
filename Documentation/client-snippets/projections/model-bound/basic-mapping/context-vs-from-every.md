```typescript title="Specific context vs every event"
import { eventType, fromEvent, fromEvery, setFromContext } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class OrderPlacedForLifecycle {
    @field(String) readonly customerName: string;

    constructor(customerName: string) {
        this.customerName = customerName;
    }
}

@eventType()
export class OrderShippedForLifecycle {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string) {
        this.trackingNumber = trackingNumber;
    }
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
