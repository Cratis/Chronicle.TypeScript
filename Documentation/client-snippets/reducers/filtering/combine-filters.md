```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventSourceType, eventStreamType, filterEventsByTag, Guid, IEventLog, reducer } from '@cratis/chronicle';

@eventType()
class ReducersFilteringCombineOrderPlaced {
    @field(Number) totalAmount = 0;
}

class ReducersFilteringPremiumFulfillmentTotals { count = 0; total = 0; }

class ReducersFilteringCombineOrderService {
    constructor(private readonly eventLog: IEventLog) {}

    async placePremiumOrder(totalAmount: number): Promise<void> {
        const result = await this.eventLog.append(Guid.create().toString(),
            Object.assign(new ReducersFilteringCombineOrderPlaced(), { totalAmount }),
            { tags: ['premium'], sourceType: 'order', streamType: 'fulfillment' });
        if (!result.isSuccess) throw new Error('Order placement failed');
    }
}

@reducer('', undefined, ReducersFilteringPremiumFulfillmentTotals)
@filterEventsByTag('premium')
@eventSourceType('order')
@eventStreamType('fulfillment')
class ReducersFilteringPremiumFulfillmentTotalsReducer {
    reducersFilteringCombineOrderPlaced(event: ReducersFilteringCombineOrderPlaced,
        current: ReducersFilteringPremiumFulfillmentTotals | undefined): ReducersFilteringPremiumFulfillmentTotals {
        return { count: (current?.count ?? 0) + 1, total: (current?.total ?? 0) + event.totalAmount };
    }
}
```
