```typescript
import { eventType, filterEventsByTag, reducer } from '@cratis/chronicle';

@eventType()
class ReducersFilteringMultiTagOrderPlaced {
    constructor(readonly totalAmount: number) {}
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
