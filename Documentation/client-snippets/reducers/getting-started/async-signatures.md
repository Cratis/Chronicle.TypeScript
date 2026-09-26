```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReducersAsyncSignaturesOrderPlaced {
    @field(String) readonly orderId: string;

    constructor(orderId: string) {
        this.orderId = orderId;
    }
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
