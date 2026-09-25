---
title: External services
description: Register HTTP and database external services with the Chronicle kernel from TypeScript.
---

See [External Services](/chronicle/external-services/) for what an external service is. External services are usually configured in the Workbench, but the TypeScript client also exposes a programmatic API on `eventStore.externalServices`.

## Register an HTTP service with bearer token authentication

The token comes from your own configuration; this example reads it from an environment variable.

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const token = process.env.CUSTOMERS_API_TOKEN!;
const client = new ChronicleClient(ChronicleOptions.development({ discoveryPatterns: [] }));
const eventStore = await client.getEventStore('MyStore');

await eventStore.externalServices.register('CustomersApi', builder => builder
    .http('https://api.example.com')
    .withBearerToken(token)
    .withHeader('X-Tenant', 'acme'));

client.dispose();
```

## Register a PostgreSQL database service

This excerpt uses the `eventStore` from the example above, before the client is disposed; `password` comes from your configuration.

```typescript
await eventStore.externalServices.register('CustomersDb', builder => builder
    .postgreSql('db.example.com', 'customers', 'postgres', password, 5432));
```

The client uses the name as the service identifier. `register` does not check the kernel's response, so a definition the kernel rejects does not raise an error; confirm the service in the Workbench after you register it.

## API

`eventStore.externalServices` exposes:

- `register(name, configure)`

The builder passed to `configure` exposes:

- `http(url)`
- `withBasicAuth(username, password)`
- `withBearerToken(token)`
- `withOAuth(authority, clientId, clientSecret)`
- `withHeader(key, value)`
- `msSql(host, database, username, password, port?)`
- `postgreSql(host, database, username, password, port?)`
- `withOption(key, value)`
