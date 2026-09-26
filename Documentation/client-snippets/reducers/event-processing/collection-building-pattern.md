```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingCustomerAction {
    @field(String) readonly type: string;
    @field(String) readonly description: string;

    constructor(type: string, description: string) {
        this.type = type;
        this.description = description;
    }
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
