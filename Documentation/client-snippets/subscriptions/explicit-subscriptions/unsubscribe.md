```typescript
import { IEventStore } from '@cratis/chronicle';

class SubscriptionsExplicitUnsubscribe {
    static async run(store: IEventStore): Promise<void> {
        await store.subscriptions.unsubscribe('orders-from-fulfillment');
    }
}
```
