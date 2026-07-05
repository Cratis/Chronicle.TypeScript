# Webhooks

See [Webhooks](/chronicle/webhooks/) for what a webhook is. Use `eventStore.webhooks` to register webhook observers for event streams.

## Register a webhook programmatically

```typescript
import { ChronicleClient, ChronicleOptions, eventType } from '@cratis/chronicle';

@eventType()
class EmployeeHired {
    constructor(readonly firstName: string, readonly lastName: string) {}
}

const client = new ChronicleClient(ChronicleOptions.development());
const eventStore = await client.getEventStore('MyStore');

await eventStore.webhooks.register(
    'employee-audit',
    'https://example.internal/webhooks/employee-audit',
    builder => {
        builder
            .withEventType(EmployeeHired)
            .withHeader('x-source', 'chronicle')
            .withBearerToken('token-value');
    }
);

client.dispose();
```

## Define discoverable webhooks with decorators

The `@webhook(...)` decorator registers a webhook class for discovery:

- `@webhook(targetUrl)`
- `@webhook(id, targetUrl)`
- `@webhook(id, targetUrl, eventSequenceId)`

```typescript
import 'reflect-metadata';
import { IWebhook, IWebhookDefinitionBuilder, webhook } from '@cratis/chronicle';

@webhook('employee-webhook', 'https://example.internal/webhooks/employees')
class EmployeeWebhook implements IWebhook {
    define(builder: IWebhookDefinitionBuilder): void {
        builder
            .notReplayable()
            .withHeader('x-client', 'chronicle-ts');
    }
}
```

When the event store registers artifacts, webhooks are discovered and registered automatically.

## API

`eventStore.webhooks` exposes:

- `discover()`
- `registerDiscovered()`
- `register(webhookId, targetUrl, configure)`
- `getWebhooks()`
- `remove(webhookId)`
