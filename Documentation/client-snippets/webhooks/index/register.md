```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class WebhooksIndexAccountOpened {
    constructor(readonly ownerName: string) {}
}

class WebhooksIndexRegister {
    constructor(
        private readonly store: IEventStore,
        private readonly webhookToken: string
    ) {}

    async registerWebhook(): Promise<void> {
        await this.store.webhooks.register(
            'account-events',
            'https://example.com/chronicle/webhooks',
            builder => {
                builder
                    .withEventType(WebhooksIndexAccountOpened)
                    .withHeader('x-source', 'my-app')
                    .withBearerToken(this.webhookToken);
            }
        );
    }
}
```
