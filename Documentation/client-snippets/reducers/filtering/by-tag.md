```typescript
import { eventType, filterEventsByTag, IEventStore, reducer } from '@cratis/chronicle';

@eventType()
class ReducersFilteringByTagOrderPlaced {
    constructor(readonly totalAmount: number) {}
}

class ReducersFilteringPriorityOrderTotals {
    count = 0;
    total = 0;
}

@reducer('', undefined, ReducersFilteringPriorityOrderTotals)
@filterEventsByTag('priority')
class ReducersFilteringPriorityOrderTotalsReducer {
    reducersFilteringByTagOrderPlaced(
        event: ReducersFilteringByTagOrderPlaced,
        current: ReducersFilteringPriorityOrderTotals | undefined
    ): ReducersFilteringPriorityOrderTotals {
        return {
            count: (current?.count ?? 0) + 1,
            total: (current?.total ?? 0) + event.totalAmount
        };
    }
}

class ReducersFilteringByTagOrderService {
    constructor(private readonly store: IEventStore) {}

    async placePriorityOrder(eventSourceId: string, totalAmount: number): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new ReducersFilteringByTagOrderPlaced(totalAmount),
            { tags: ['priority'] });
    }
}
```
