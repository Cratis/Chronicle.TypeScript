```typescript
import { eventType, filterEventsByTag, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReducersFilteringMultiTagOrderPlaced {
    @field(Number) readonly totalAmount: number;

    constructor(totalAmount: number) {
        this.totalAmount = totalAmount;
    }
}

class ReducersFilteringFastTrackOrderTotals {
    count = 0;
}

@reducer('', undefined, ReducersFilteringFastTrackOrderTotals)
@filterEventsByTag('priority')
@filterEventsByTag('express')
class ReducersFilteringFastTrackOrderTotalsReducer {
    reducersFilteringMultiTagOrderPlaced(
        _event: ReducersFilteringMultiTagOrderPlaced,
        current: ReducersFilteringFastTrackOrderTotals | undefined
    ): ReducersFilteringFastTrackOrderTotals {
        return { count: (current?.count ?? 0) + 1 };
    }
}
```
