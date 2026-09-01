```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingCustomerAction {
    constructor(readonly type: string, readonly description: string) {}
}

class EventProcessingActivity {
    type = '';
    timestamp = new Date();
    description = '';
}

class EventProcessingCustomerActivityLog {
    activities: EventProcessingActivity[] = [];
}

@reducer('', undefined, EventProcessingCustomerActivityLog)
class EventProcessingCustomerActivityLogReducer {
    eventProcessingCustomerAction(
        event: EventProcessingCustomerAction,
        current: EventProcessingCustomerActivityLog | undefined,
        context: EventContext
    ): EventProcessingCustomerActivityLog {
        // Copy rather than mutate — current.activities may still be referenced by a held snapshot
        const activities = [...(current?.activities ?? [])];

        activities.push({ type: event.type, timestamp: context.occurred, description: event.description });

        return { activities };
    }
}
```
