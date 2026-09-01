```typescript
import { eventType, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingMinimalMetricRecorded {
    constructor(readonly value: number) {}
}

class EventProcessingMinimalStats {
    count = 0;
    sum = 0;
}

@reducer('', undefined, EventProcessingMinimalStats)
class EventProcessingMinimalStatsReducer {
    // Efficient - only creates a new object when needed
    eventProcessingMinimalMetricRecorded(
        event: EventProcessingMinimalMetricRecorded,
        current: EventProcessingMinimalStats | undefined
    ): EventProcessingMinimalStats {
        if (!current) {
            return { count: 1, sum: event.value };
        }

        return { count: current.count + 1, sum: current.sum + event.value };
    }
}
```
