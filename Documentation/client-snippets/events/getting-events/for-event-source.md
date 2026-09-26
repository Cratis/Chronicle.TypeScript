```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GettingEventsOrderPlaced {
    @field(String) readonly orderId: string;
    @field(Number) readonly total: number;

    constructor(orderId: string = '', total: number = 0) {
        this.orderId = orderId;
        this.total = total;
    }
}

@eventType()
class GettingEventsOrderCancelled {
    @field(String) readonly orderId: string;
    @field(String) readonly reason: string;

    constructor(orderId: string = '', reason: string = '') {
        this.orderId = orderId;
        this.reason = reason;
    }
}

async function getOrderEvents(store: IEventStore, orderId: string): Promise<void> {
    // Filters the timeline to only the order events you care about.
    const events = await store.eventLog.getForEventSourceIdAndEventTypes(
        orderId,
        [GettingEventsOrderPlaced, GettingEventsOrderCancelled]);

    for (const event of events) {
        console.log(`${event.eventType.id.value} at sequence ${event.context.sequenceNumber}`);
    }
}
```
