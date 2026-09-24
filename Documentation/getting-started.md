# Getting Started

## Prerequisite: Chronicle Kernel

You need a running Chronicle Kernel before connecting with the TypeScript client.

The easiest local setup is the development Docker image:

```bash
docker run -p 35000:35000 cratis/chronicle:latest-development
```

## Installation

```bash
yarn add @cratis/chronicle @cratis/fundamentals reflect-metadata
```

> **Note:** Chronicle uses `reflect-metadata` to store decorator metadata. Import it once at the entry point of your application. The client initializes `Symbol.metadata` where the runtime does not provide it.

The package and its exported subpaths load directly in Node.js ESM without a bundler. After installing, you can check both entry points:

```bash
node --input-type=module -e "import { ChronicleClient } from '@cratis/chronicle'; import { EventSequenceId } from '@cratis/chronicle/eventSequences'; console.log(typeof ChronicleClient, EventSequenceId.eventLog.value)"
# function event-log
```

## Setup

Import `reflect-metadata` at the top of your application entry point:

```typescript
import 'reflect-metadata';
```

## Decorator mode and schema types

Use TypeScript 5.2 or newer with standard decorators (leave `experimentalDecorators` and `emitDecoratorMetadata` unset). Existing projects with `experimentalDecorators: true` continue to use the legacy decorators. For standard-mode event types and read models, declare member types explicitly with `@field` from `@cratis/fundamentals`; TypeScript does not emit `design:type` metadata in this mode. Set array element types with `@field(Array, { genericArguments: [ItemType] })`. Concept classes can declare `static readonly valueType = String`, `Number`, `Boolean`, `Guid`, or `Date` to identify their serialized value without legacy metadata.

```typescript
import 'reflect-metadata';
import { field, ConceptAs } from '@cratis/fundamentals';
import { eventType, getEventTypeJsonSchemaFor } from '@cratis/chronicle/events';

class Quantity extends ConceptAs<number> {
    static readonly valueType = Number;
}

@eventType('stock-counted')
class StockCounted {
    @field(Quantity) quantity!: Quantity;
}

console.log(getEventTypeJsonSchemaFor(StockCounted).properties?.quantity.type);
// number
```

An event type or read model with no members is valid. An unresolved member type or an array without `genericArguments` fails when its schema is first read, or during connection before any artifacts are registered with the Kernel. The remaining constructor-property examples in the legacy-mode client snippets use `experimentalDecorators: true` and do not represent standard-mode schema declarations. For standard mode, use `@field` on each typed member as shown above. Chronicle supports standard public instance fields, not standard accessors or getters, for property decorators.

## Connecting to Chronicle

Create a `ChronicleClient` with a connection string pointing to your Chronicle Kernel instance:

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const options = ChronicleOptions.fromConnectionString('chronicle://localhost:35000');
const client = new ChronicleClient(options);

// Get an event store
const store = await client.getEventStore('MyStore');

// ... use the store

// Always dispose when done
client.dispose();
```

## Connection String Format

Chronicle connection strings use the `chronicle://` scheme:

```text
chronicle://localhost:35000
chronicle://username:password@chronicle.example.com:35000
```

## Development Mode

For local development, use:

```typescript
const options = ChronicleOptions.development();
```

This connects to `chronicle://localhost:35000` by default.

## Where to next

- [Events and event logs](event-log.md), [Event Types](event-types.md), and [Event Evolution](event-type-migrations.md) to model and evolve your event schema.
- [Reducers](reducers.md), [Reactors](reactors.md), and [Projections](projections.md) to build read models and side effects from your events.
- [Read Models](read-models.md) to query projected state.
- [Event Seeding](seeding.md) and [Transactions](transactions.md) for test data and unit-of-work semantics.
- [Compliance](compliance/index.md) for PII handling and GDPR erasure.
