```typescript
import { IEventStore } from '@cratis/chronicle';

class SubscriptionsExplicitNoFilter {
    static async run(store: IEventStore): Promise<void> {
        // All events from fulfillment-service outbox will be forwarded
        await store.subscriptions.subscribe('all-fulfillment-events', 'fulfillment-service');
    }
}
```
