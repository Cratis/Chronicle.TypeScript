```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class ReducersSyncSignaturesOrderPlaced {
    constructor(readonly orderId: string) {}
}

class ReducersSyncSignaturesOrderSummary {
    orderId = '';
    lastUpdated = new Date();
}

@reducer('', undefined, ReducersSyncSignaturesOrderSummary)
class ReducersSyncSignaturesOrderSummaryReducer {
    // Synchronous, with context
    reducersSyncSignaturesOrderPlaced(
        event: ReducersSyncSignaturesOrderPlaced,
        current: ReducersSyncSignaturesOrderSummary | undefined,
        context: EventContext
    ): ReducersSyncSignaturesOrderSummary {
        return { orderId: event.orderId, lastUpdated: context.occurred };
    }
}
```
