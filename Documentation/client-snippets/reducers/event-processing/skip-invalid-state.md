```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingSkipItemAdded {
    @field(Number) readonly price: number;

    constructor(price: number) {
        this.price = price;
    }
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
