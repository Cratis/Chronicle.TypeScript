---
title: Webhooks
description: Register Chronicle webhooks from TypeScript, either in code or as decorated classes, so external systems are called when events are appended.
---

See [Webhooks](/chronicle/webhooks/) for what a webhook is. Use `eventStore.webhooks` to register webhook observers for event streams.

Start with the [TypeScript client setup](./getting-started.md). Choose one registration recipe for a webhook: make an explicit call, or declare an imported class for discovery.

Chronicle sends events to the target URL from the kernel, so the URL must be reachable from the kernel, not only from your application. Use `withBearerToken`, `withBasicAuth`, or `withOAuth` rather than an unauthenticated endpoint, and keep the secrets in configuration.

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

For discovery instead of an explicit registration call, declare a class with `@webhook(...)`:

- `@webhook(targetUrl)`
- `@webhook(id, targetUrl)`
- `@webhook(id, targetUrl, eventSequenceId)`

Import the modules that declare the webhook classes before creating the event store. On store creation, `getEventStore(...)` discovers and registers the classes supplied by the client's artifact provider with the store's other artifacts. Looking up a cached store does not rerun that creation path.

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

## API

`eventStore.webhooks` exposes:

- `discover()`
- `registerDiscovered()`
- `register(webhookId, targetUrl, configure)`
- `getWebhooks()`
- `remove(webhookId)`
