```typescript
import { eventType, reducer, tag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TaggingReducersOrderPlaced {
    @field(Number) readonly totalAmount: number;

    constructor(totalAmount: number) {
        this.totalAmount = totalAmount;
    }
}

class TaggingReducersOrderAnalytics {
    orderCount = 0;
    totalAmount = 0;
}

@reducer('', undefined, TaggingReducersOrderAnalytics)
@tag('Analytics')
class TaggingReducersOrderAnalyticsReducer {
    taggingReducersOrderPlaced(
        event: TaggingReducersOrderPlaced,
        current: TaggingReducersOrderAnalytics | undefined
    ): TaggingReducersOrderAnalytics {
        return {
            orderCount: (current?.orderCount ?? 0) + 1,
            totalAmount: (current?.totalAmount ?? 0) + event.totalAmount
        };
    }
}
```
