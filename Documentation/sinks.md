# Sinks

See [Sinks](/chronicle/sinks/) for what a sink is and the storage backends Chronicle ships with. By default the client uses **MongoDB**, so most applications never need to think about sinks at all. You only configure a sink type when you want your read models stored somewhere else — for example, a SQL database.

## Well-Known Sink Types

The `WellKnownSinks` constant exposes the sink types Chronicle ships with:

```typescript
import { WellKnownSinks } from '@cratis/chronicle';

WellKnownSinks.MongoDB;   // 'MongoDB' — the default
WellKnownSinks.SQL;       // 'SQL'
WellKnownSinks.InMemory;  // 'InMemory'
WellKnownSinks.NotSet;    // 'NotSet' — no sink
```

A sink type identifier is just a string, so you can also pass the identifier of a custom sink registered in your Chronicle Kernel.

## Configuring the Default Sink Type

The default sink type is configured on `ChronicleOptions` through `defaultSinkTypeId`. Every projection, reducer, and read model registered by the client uses this sink type unless overridden by the Kernel configuration.

When you don't set it, it defaults to `WellKnownSinks.MongoDB`.

To persist read models into SQL instead, pass `defaultSinkTypeId` when creating the options:

```typescript
import { ChronicleClient, ChronicleOptions, WellKnownSinks } from '@cratis/chronicle';

const options = ChronicleOptions.fromConnectionString(
    'chronicle://localhost:35000',
    { defaultSinkTypeId: WellKnownSinks.SQL });

const client = new ChronicleClient(options);
```

The same option works with the development factory:

```typescript
import { ChronicleClient, ChronicleOptions, WellKnownSinks } from '@cratis/chronicle';

const options = ChronicleOptions.development({ defaultSinkTypeId: WellKnownSinks.SQL });
const client = new ChronicleClient(options);
```

## Reading the Configured Sink Type

The configured value is available on the options as `defaultSinkTypeId`:

```typescript
console.log(client.options.defaultSinkTypeId); // 'SQL'
```
