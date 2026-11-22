---
title: External services
description: Register HTTP and database external services with the Chronicle kernel from TypeScript, so reactors and projections can reach systems outside Chronicle.
---

See [External Services](/chronicle/external-services/) for what an external service is. External services are usually configured in the Workbench, but the TypeScript client also exposes a programmatic API on `eventStore.externalServices`.

Start with the [TypeScript client setup](./getting-started.md). For programmatic registration, choose the HTTP recipe for an HTTP service or the PostgreSQL excerpt for a database service. These are separate recipes, not a sequential script.

The client uses the name as the service identifier. `register` rejects with the kernel's validation or exception messages when the kernel does not accept the definition.

## Register an HTTP service with bearer token authentication

The token comes from your own configuration; this example reads it from an environment variable.

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const token = process.env.CUSTOMERS_API_TOKEN!;
const client = new ChronicleClient(ChronicleOptions.development());
const eventStore = await client.getEventStore('MyStore');

await eventStore.externalServices.register('CustomersApi', builder => builder
    .http('https://api.example.com')
    .withBearerToken(token)
    .withHeader('X-Tenant', 'acme'));

client.dispose();
```

## Request OAuth scopes for an HTTP service

For OAuth authentication, replace the bearer-token configuration above with the following registration while the client is still alive. Read the authority and credentials from your configuration:

```typescript
await eventStore.externalServices.register('CustomersApi', builder => builder
    .http('https://api.example.com')
    .withOAuth(
        process.env.OAUTH_AUTHORITY!,
        process.env.OAUTH_CLIENT_ID!,
        process.env.OAUTH_CLIENT_SECRET!,
        'customers.read customers.write'
    )
    .withHeader('X-Tenant', 'acme'));
```

The optional fourth argument is a space-delimited string forwarded unchanged. Existing three-argument calls still work; an omitted or empty scope sends no scope value.

> [!WARNING]
> Chronicle kernels released before OAuth scope support ([Cratis/Chronicle#5139](https://github.com/Cratis/Chronicle/issues/5139)) ignore the scope: the registration succeeds, but tokens are requested without it. Upgrade the kernel before relying on a scope.

## Register a PostgreSQL database service

For the PostgreSQL alternative, reuse the `eventStore` setup above while its client is still alive, before `client.dispose()`. Supply `password` from your configuration.

```typescript
await eventStore.externalServices.register('CustomersDb', builder => builder
    .postgreSql('db.example.com', 'customers', 'postgres', password, 5432));
```

## API

`eventStore.externalServices` exposes:

- `register(name, configure)`

The builder passed to `configure` exposes:

- `http(url)`
- `withBasicAuth(username, password)`
- `withBearerToken(token)`
- `withOAuth(authority, clientId, clientSecret, scope?)`
- `withHeader(key, value)`
- `msSql(host, database, username, password, port?)`
- `postgreSql(host, database, username, password, port?)`
- `withOption(key, value)`
