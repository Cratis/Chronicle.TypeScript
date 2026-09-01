```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingDataRecorded {
    constructor(readonly value: number) {}
}

class EventProcessingAnalytics {
    eventCount = 0;
    firstEventTime = new Date();
    lastEventTime = new Date();
    totalValue = 0;
}

@reducer('', undefined, EventProcessingAnalytics)
class EventProcessingAnalyticsReducer {
    eventProcessingDataRecorded(
        event: EventProcessingDataRecorded,
        current: EventProcessingAnalytics | undefined,
        context: EventContext
    ): EventProcessingAnalytics {
        if (!current) {
            // First event - initialize state
            return {
                eventCount: 1,
                firstEventTime: context.occurred,
                lastEventTime: context.occurred,
                totalValue: event.value
            };
        }

        // Update existing state
        return {
            ...current,
            eventCount: current.eventCount + 1,
            lastEventTime: context.occurred,
            totalValue: current.totalValue + event.value
        };
    }
}
```
