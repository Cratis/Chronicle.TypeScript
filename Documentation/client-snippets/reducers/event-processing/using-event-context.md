```typescript
import { EventContext, eventType, Guid, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingContextOrderPlaced {
    @field(Guid) readonly orderId: Guid;
    @field(Number) readonly amount: number;

    constructor(orderId: Guid, amount: number) {
        this.orderId = orderId;
        this.amount = amount;
    }
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
