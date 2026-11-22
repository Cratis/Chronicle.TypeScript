```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class WebhooksIndexAccountOpened {
    @field(String) readonly ownerName: string;

    constructor(ownerName: string) {
        this.ownerName = ownerName;
    }
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

    async registerWebhookWithOAuth(authority: string, clientId: string, clientSecret: string): Promise<void> {
        await this.store.webhooks.register(
            'account-events-oauth',
            'https://example.com/chronicle/webhooks',
            builder => builder
                .withEventType(WebhooksIndexAccountOpened)
                .withOAuth(authority, clientId, clientSecret, 'accounts.read accounts.write')
                .withHeader('x-source', 'my-app')
        );
    }
}
```
