```typescript
import { eventType, filterEventsByTag, IEventStore, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilterByTagOrderPlaced {
    @field(Number) readonly totalAmount: number;

    constructor(totalAmount: number) {
        this.totalAmount = totalAmount;
    }
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
