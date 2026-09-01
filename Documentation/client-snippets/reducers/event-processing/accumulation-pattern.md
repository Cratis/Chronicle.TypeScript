```typescript
import { eventType, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingMetricRecorded {
    constructor(readonly value: number) {}
}

class EventProcessingStatistics {
    sum = 0;
    count = 0;
    average = 0;
}

@reducer('', undefined, EventProcessingStatistics)
class EventProcessingStatisticsReducer {
    eventProcessingMetricRecorded(event: EventProcessingMetricRecorded, current: EventProcessingStatistics | undefined): EventProcessingStatistics {
        const sum = (current?.sum ?? 0) + event.value;
        const count = (current?.count ?? 0) + 1;

        return { sum, count, average: sum / count };
    }
}
```
