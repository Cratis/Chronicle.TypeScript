# External Services

See [External Services](/chronicle/external-services/) for what an external service is. External services are usually configured in the Workbench, but the TypeScript client also exposes a programmatic API on `eventStore.externalServices`.

## Register an HTTP service with bearer token authentication

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const client = new ChronicleClient(ChronicleOptions.development());
const eventStore = await client.getEventStore('MyStore');

await eventStore.externalServices.register('CustomersApi', builder => builder
    .http('https://api.example.com')
    .withBearerToken(token)
    .withHeader('X-Tenant', 'acme'));

client.dispose();
```

## Register a PostgreSQL database service

```typescript
await eventStore.externalServices.register('CustomersDb', builder => builder
    .postgreSql('db.example.com', 'customers', 'postgres', password, 5432));
```

Registering the same name again overwrites the previous definition, so this is safe to call repeatedly (for example, on every application startup).

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
