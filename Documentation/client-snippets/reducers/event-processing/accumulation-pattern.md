```typescript
import { eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingMetricRecorded {
    @field(Number) readonly value: number;

    constructor(value: number) {
        this.value = value;
    }
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
