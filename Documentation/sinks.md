---
title: Sinks
description: Choose where the TypeScript client stores the read models it registers, with defaultSinkTypeId and WellKnownSinks, and override the sink per read model.
---

See [Sinks](/chronicle/sinks/) for what a sink is and the storage backends Chronicle ships with. By default the client uses **MongoDB**, so most applications never need to think about sinks at all. You only configure a sink type when you want your read models stored somewhere else — for example, a SQL database.

## Well-Known Sink Types

The `WellKnownSinks` constant exposes the sink types Chronicle ships with:

```typescript
import { WellKnownSinks } from '@cratis/chronicle';

WellKnownSinks.MongoDB;   // 'MongoDB' — the default
WellKnownSinks.SQL;       // 'SQL'
WellKnownSinks.InMemory;  // 'InMemory'
WellKnownSinks.None;      // 'None' — no sink
WellKnownSinks.Neo4j;     // 'Neo4j' — the default sink of graph projections
WellKnownSinks.InMemoryGraph; // 'InMemoryGraph' — a graph kept in the kernel's memory
```

A sink type identifier is a string, so you can also pass the identifier of a custom sink registered in your Chronicle Kernel.

## Configuring the Default Sink Type

The default sink type is configured on `ChronicleOptions` through `defaultSinkTypeId`. The client registers every active projection, reducer, and read model with this sink type. A passive projection is registered with `WellKnownSinks.None` instead.

When you don't set it, it defaults to `WellKnownSinks.MongoDB`.

To persist read models into SQL instead, pass `defaultSinkTypeId` when creating the options. The kernel must have SQL read-model storage configured; see [Sinks](/chronicle/sinks/).

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

## Graph Projections

A property graph is not stored by the sink of document read models. [Graph projections](./graph-projections.md) use their own sink type, set with `defaultGraphSinkTypeId`. It defaults to `WellKnownSinks.Neo4j`, and `defaultSinkTypeId` does not apply to graphs.

```typescript
const options = ChronicleOptions.development({ defaultGraphSinkTypeId: WellKnownSinks.InMemoryGraph });
```
