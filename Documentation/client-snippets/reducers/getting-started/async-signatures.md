```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class ReducersAsyncSignaturesOrderPlaced {
    constructor(readonly orderId: string) {}
}

class ReducersAsyncSignaturesOrderSummary {
    orderId = '';
}

@reducer('', undefined, ReducersAsyncSignaturesOrderSummary)
class ReducersAsyncSignaturesOrderSummaryReducer {
    // Async without context
    async reducersAsyncSignaturesOrderPlaced(
        event: ReducersAsyncSignaturesOrderPlaced,
        current: ReducersAsyncSignaturesOrderSummary | undefined
    ): Promise<ReducersAsyncSignaturesOrderSummary> {
        return { orderId: event.orderId };
    }
}
```
