```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReducersSyncSignaturesOrderPlaced {
    @field(String) readonly orderId: string;

    constructor(orderId: string) {
        this.orderId = orderId;
    }
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
