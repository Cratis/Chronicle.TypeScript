```typescript
import { eventType, filterEventsByTag, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilteringWithReducerOrderPlaced {
    @field(Number) readonly totalAmount: number;

    constructor(totalAmount: number) {
        this.totalAmount = totalAmount;
    }
}

class FilteringPremiumOrderTotals {
    count = 0;
    total = 0;
}

@reducer('', undefined, FilteringPremiumOrderTotals)
@filterEventsByTag('premium')
class FilteringPremiumOrderTotalsReducer {
    filteringWithReducerOrderPlaced(event: FilteringWithReducerOrderPlaced, current: FilteringPremiumOrderTotals | undefined): FilteringPremiumOrderTotals {
        return {
            count: (current?.count ?? 0) + 1,
            total: (current?.total ?? 0) + event.totalAmount
        };
    }
}
```
