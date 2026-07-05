```typescript
import { IEventStore } from '@cratis/chronicle';
import { WebhookDefinition } from '@cratis/chronicle.contracts';

class WebhooksIndexQuery {
    constructor(private readonly store: IEventStore) {}

    async getAllWebhooks(): Promise<WebhookDefinition[]> {
        return this.store.webhooks.getWebhooks();
    }
}
```
