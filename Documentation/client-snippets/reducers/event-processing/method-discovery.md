```typescript
import { EventContext, eventType, Guid, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingOrderCreated {
    constructor(readonly orderId: Guid) {}
}

@eventType()
class EventProcessingItemAdded {
    constructor(readonly price: number) {}
}

class EventProcessingOrderSummary {
    orderId: Guid = Guid.empty;
    total = 0;
    lastUpdated = new Date();
}

// Method names must be the exact camelCase of the event's class name -
// Chronicle discovers handlers by name, not by parameter type.
@reducer('', undefined, EventProcessingOrderSummary)
class EventProcessingOrderSummaryReducer {
    eventProcessingOrderCreated(
        event: EventProcessingOrderCreated,
        current: EventProcessingOrderSummary | undefined,
        context: EventContext
    ): EventProcessingOrderSummary {
        return { orderId: event.orderId, total: 0, lastUpdated: context.occurred };
    }

    eventProcessingItemAdded(
        event: EventProcessingItemAdded,
        current: EventProcessingOrderSummary | undefined,
        context: EventContext
    ): EventProcessingOrderSummary | undefined {
        if (!current) return undefined; // Skip if no order exists

        return { ...current, total: current.total + event.price, lastUpdated: context.occurred };
    }
}
```
