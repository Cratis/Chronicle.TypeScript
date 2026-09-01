```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingHourlyMetricRecorded {
    constructor(readonly value: number) {}
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
