```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class PassiveReducersDataRecorded {
    constructor(readonly value: number) {}
}

class PassiveReducersAnalytics {
    recordCount = 0;
    totalValue = 0;
    lastUpdated = new Date();
}

// isActive: false — registered with the Kernel but does not automatically observe events
@reducer('', undefined, PassiveReducersAnalytics, false)
class PassiveReducersTemporaryAnalyticsReducer {
    passiveReducersDataRecorded(
        event: PassiveReducersDataRecorded,
        current: PassiveReducersAnalytics | undefined,
        context: EventContext
    ): PassiveReducersAnalytics {
        const count = current?.recordCount ?? 0;
        const sum = current?.totalValue ?? 0;

        return { recordCount: count + 1, totalValue: sum + event.value, lastUpdated: context.occurred };
    }
}
```
