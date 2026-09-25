---
title: Webhooks
description: Register Chronicle webhooks from TypeScript, in code or as decorated classes.
---

See [Webhooks](/chronicle/webhooks/) for what a webhook is. Use `eventStore.webhooks` to register webhook observers for event streams.

## Register a webhook programmatically

```typescript
import 'reflect-metadata';
import { ChronicleClient, ChronicleOptions, eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EmployeeHired {
    @field(String) firstName: string;
    @field(String) lastName: string;

    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

const client = new ChronicleClient(ChronicleOptions.development({ discoveryPatterns: [] }));
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

`getEventStore(...)` registers every `@webhook` class whose module has been imported, together with the store's other artifacts.

Chronicle sends events to the target URL from the kernel, so the URL must be reachable from the kernel, not only from your application. Use `withBearerToken`, `withBasicAuth`, or `withOAuth` rather than an unauthenticated endpoint, and keep the secrets in configuration.

## API

`eventStore.webhooks` exposes:

- `discover()`
- `registerDiscovered()`
- `register(webhookId, targetUrl, configure)`
- `getWebhooks()`
- `remove(webhookId)`
