```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class GettingEventsOrderPlaced {
    constructor(readonly orderId: string = '', readonly total: number = 0) {}
}

@eventType()
class GettingEventsOrderCancelled {
    constructor(readonly orderId: string = '', readonly reason: string = '') {}
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
