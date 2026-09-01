```typescript
import { EventContext, eventType, Guid, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingContextOrderPlaced {
    constructor(readonly orderId: Guid, readonly amount: number) {}
}

class EventProcessingOrderSummaryWithContext {
    orderId: Guid = Guid.empty;
    total = 0;
    placedAt = new Date();
    correlationId = '';
}

@reducer('', undefined, EventProcessingOrderSummaryWithContext)
class EventProcessingOrderSummaryWithContextReducer {
    eventProcessingContextOrderPlaced(
        event: EventProcessingContextOrderPlaced,
        current: EventProcessingOrderSummaryWithContext | undefined,
        context: EventContext
    ): EventProcessingOrderSummaryWithContext {
        return {
            orderId: event.orderId,
            total: event.amount,
            placedAt: context.occurred,
            correlationId: context.correlationId
        };
    }
}
```
