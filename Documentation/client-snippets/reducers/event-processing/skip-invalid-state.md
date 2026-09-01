```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingSkipItemAdded {
    constructor(readonly price: number) {}
}

class EventProcessingSkipOrderSummary {
    total = 0;
}

@reducer('', undefined, EventProcessingSkipOrderSummary)
class EventProcessingSkipOrderSummaryReducer {
    eventProcessingSkipItemAdded(
        event: EventProcessingSkipItemAdded,
        current: EventProcessingSkipOrderSummary | undefined,
        context: EventContext
    ): EventProcessingSkipOrderSummary | undefined {
        // Can't add items if order doesn't exist
        if (!current) return undefined;

        return { total: current.total + event.price };
    }
}
```
