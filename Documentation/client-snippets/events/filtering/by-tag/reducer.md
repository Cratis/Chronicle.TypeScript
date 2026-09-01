```typescript
import { eventType, filterEventsByTag, IEventStore, reducer } from '@cratis/chronicle';

@eventType()
class FilterByTagOrderPlaced {
    constructor(readonly totalAmount: number) {}
}

class FilterByTagPriorityOrderTotals {
    totalAmount = 0;
}

@reducer('', undefined, FilterByTagPriorityOrderTotals)
@filterEventsByTag('priority')
class FilterByTagPriorityOrderTotalsReducer {
    filterByTagOrderPlaced(
        event: FilterByTagOrderPlaced,
        current: FilterByTagPriorityOrderTotals | undefined
    ): FilterByTagPriorityOrderTotals {
        return { totalAmount: (current?.totalAmount ?? 0) + event.totalAmount };
    }
}

class FilterByTagCheckoutService {
    constructor(private readonly store: IEventStore) {}

    async placePriorityOrder(eventSourceId: string, totalAmount: number): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new FilterByTagOrderPlaced(totalAmount),
            { tags: ['priority'] });
    }
}
```
