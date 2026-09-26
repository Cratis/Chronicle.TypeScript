```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingHourlyMetricRecorded {
    @field(Number) readonly value: number;

    constructor(value: number) {
        this.value = value;
    }
}

class EventProcessingHourlyMetrics {
    metricsByHour: Record<number, number> = {};
}

@reducer('', undefined, EventProcessingHourlyMetrics)
class EventProcessingHourlyMetricsReducer {
    eventProcessingHourlyMetricRecorded(
        event: EventProcessingHourlyMetricRecorded,
        current: EventProcessingHourlyMetrics | undefined,
        context: EventContext
    ): EventProcessingHourlyMetrics {
        const metricsByHour = { ...(current?.metricsByHour ?? {}) };
        const hour = context.occurred.getHours();

        metricsByHour[hour] = (metricsByHour[hour] ?? 0) + event.value;

        return { metricsByHour };
    }
}
```
