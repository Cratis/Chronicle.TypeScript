---
title: Get started with the TypeScript client
description: Create a Node.js project, connect to a local Chronicle kernel, append events, and read the projected read model back.
---

You want a Node.js service to record what happened as events and to query state built from them. In this guide you start from an empty folder and end with a program that appends two events, lets a reactor respond, and prints the read model Chronicle built from those events.

This page covers the TypeScript-specific setup. The shared [Chronicle get started](/chronicle/get-started/) page explains the event, projection, and reactor loop the program uses.

## Prerequisites

- **Node.js 22.19 or later.** `@cratis/chronicle` has no `engines` field, but its `undici` dependency declares `node >= 22.19.0`. On Node.js 20 the package fails when it is imported.
- **TypeScript 5.2 or later** for standard decorators. The steps below use the current `typescript` package from npm.
- **Docker**, to run a local Chronicle kernel.

## Prerequisite: Chronicle Kernel

Start the development image. It bundles MongoDB and serves Chronicle on port 35000 over TLS with a self-signed certificate:

```bash
docker run -d --name chronicle -p 127.0.0.1:35000:35000 cratis/chronicle:latest-development
```

The `127.0.0.1:` prefix publishes the port on this machine only. The development image accepts well-known development credentials, so keep it off shared networks. Remove it with `docker rm -f chronicle` when you are done; its data goes with it.

## Installation

Create the project and install the client, its `@cratis/fundamentals` peer dependency, and `reflect-metadata`:

```bash
mkdir library && cd library
npm init -y
npm pkg set type=module
npm install @cratis/chronicle @cratis/fundamentals reflect-metadata
npm install --save-dev typescript @types/node
```

`@cratis/chronicle` is an ES module package (`"type": "module"`), which is why the project sets `type` to `module`. CommonJS code can still `require()` it on Node.js versions with `require(esm)` support.

## Setup

Add a `tsconfig.json`:

```json title="tsconfig.json"
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "skipLibCheck": true,
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": ["src"]
}
```

`skipLibCheck` is required with `NodeNext` resolution: the declaration files in the `@cratis/chronicle.contracts` dependency use extensionless relative imports, which `NodeNext` reports as errors. With `"moduleResolution": "Bundler"` the declarations resolve without it.

This configuration uses standard decorators, the TypeScript default. To use legacy decorators instead, read [Decorator mode and schema types](#decorator-mode-and-schema-types) before you continue.

## Define the events

Events are facts about something that already happened. Create `src/events.ts`:

```typescript title="src/events.ts"
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class BookAdded {
    @field(String) title: string;
    @field(String) author: string;

    constructor(title: string, author: string) {
        this.title = title;
        this.author = author;
    }
}

@eventType()
export class BookBorrowed {
    @field(String) memberName: string;

    constructor(memberName: string) {
        this.memberName = memberName;
    }
}
```

`@eventType()` registers the class as an event type named after the class. `@field(String)` tells Chronicle each property's runtime type, which it uses to generate the event's JSON schema. Standard decorators emit no type metadata, so declare every property with `@field`. The client can infer a type from a default value such as `title = ''`, but a property it cannot type makes registration fail.

## Define a read model

A read model is state you query. Create `src/book.ts`:

```typescript title="src/book.ts"
import { fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';
import { BookAdded, BookBorrowed } from './events.js';

@fromEvent(BookAdded)
export class Book {
    @field(String) title = '';
    @field(String) author = '';

    @setFrom(BookBorrowed, 'memberName')
    @field(String) borrowedBy = '';
}
```

`@fromEvent(BookAdded)` makes this a model-bound projection: the kernel copies `BookAdded` properties onto `Book` properties with the same names, keyed by the event source id you append to. `@setFrom` maps a property from a different event.

:::caution[Declare every read-model property you read with @field]
The kernel stores every mapped property, but when the client reads a read model back, for example with `findInstanceById`, it only fills properties declared with `@field(Type)`. A plain `title = '';`, or a property with only `@setFrom`, comes back with its default value and no error.
:::

## React to an event

A reactor runs code when an event is appended. Create `src/notifications.ts`:

```typescript title="src/notifications.ts"
import { EventContext, reactor } from '@cratis/chronicle';
import { BookBorrowed } from './events.js';

@reactor()
export class LoanNotifications {
    async bookBorrowed(event: BookBorrowed, context: EventContext): Promise<void> {
        console.log(`Reactor: ${event.memberName} borrowed book ${context.eventSourceId}`);
    }
}
```

Chronicle matches a handler to an event by name: `bookBorrowed` handles `BookBorrowed`. A method whose name is not the camelCase event class name is never called.

## Append and query

Create `src/index.ts`:

```typescript title="src/index.ts"
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { BookAdded, BookBorrowed } from './events.js';
import { Book } from './book.js';
import './notifications.js';

const options = ChronicleOptions.development({ discoveryPatterns: [] });
const client = new ChronicleClient(options);

try {
    const store = await client.getEventStore('Library');
    const bookId = randomUUID();

    await store.eventLog.append(bookId, new BookAdded('The Pragmatic Programmer', 'Hunt and Thomas'));
    const borrowed = await store.eventLog.append(bookId, new BookBorrowed('Ada'));
    if (!borrowed.isSuccess) {
        throw new Error(`Append failed: ${JSON.stringify(borrowed.errors)}`);
    }

    const completion = await borrowed.waitForCompletion();
    console.log(`Observers caught up: ${completion.isSuccess}`);

    const book = await store.readModels.findInstanceById(Book, bookId);
    console.log(book);
} finally {
    client.dispose();
}
```

Importing the three modules runs their decorators, which is how the client knows about the event types, the read model, and the reactor. `discoveryPatterns: []` turns off the client's file-scanning discovery, which this project does not need; see [Artifact discovery](#artifact-discovery).

## Run it

```bash
npx tsc
node dist/index.js
```

You see output like this (the book id differs):

```text
Reactor: Ada borrowed book 2c609ffe-425c-4dcd-9038-92f56c5df7c5
Observers caught up: true
Book {
  title: 'The Pragmatic Programmer',
  author: 'Hunt and Thomas',
  borrowedBy: 'Ada'
}
```

If the program prints nothing and keeps running, the client cannot reach the kernel. See [Troubleshooting](#troubleshooting).

:::note[The process may not exit on its own]
With version 6.7.1, a process that registered a reactor can keep running after `client.dispose()`. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop it. In a short-lived script, call `process.exit()` after `dispose()`.
:::

## What happened

1. `getEventStore('Library')` connected, verified that the kernel's gRPC contract is compatible with this client, created the event store if needed, and registered your event types, projection, and reactor.
2. Each `append` recorded one event in the event log. An append does not throw on a constraint or concurrency violation. Check `isSuccess`, or read `constraintViolations`, `concurrencyViolation`, and `errors` on the result.
3. The kernel ran the projection and the reactor asynchronously, after the appends returned. `waitForCompletion()` waited until every observer affected by the last append had processed it. Without that wait, `findInstanceById` can return `null` or an older state.
4. `findInstanceById` returned the read model for the book, or `null` if none existed.

`waitForCompletion()` is useful in scripts and tests. In a service, design reads to tolerate the delay instead; the shared [eventual consistency](/chronicle/projections/eventual-consistency/) page explains why. It resolves immediately for a failed append, times out after 5 seconds by default, and rejects when the timeout passes.

## Decorator mode and schema types

Chronicle supports both TypeScript decorator modes. Choose one per project.

| | Standard decorators | Legacy decorators |
| --- | --- | --- |
| `tsconfig.json` | Leave `experimentalDecorators` and `emitDecoratorMetadata` unset | `"experimentalDecorators": true`, `"emitDecoratorMetadata": true` |
| TypeScript | 5.2 or later | Any version that supports `experimentalDecorators` |
| Property types | Declare each with `@field(Type)` | Inferred from `design:type` metadata on decorated properties; `@field(Type)` also works |
| Constructor parameter properties (`constructor(readonly name: string)`) | Not supported for schema types | Only with a default value for each parameter; see the caution below |

For event types and read models in standard mode, follow these rules:

- Declare every serialized member as a public instance field with `@field(Type)`. Accessors and getters are not supported.
- For arrays, give the element type: `@field(Array, { genericArguments: [ItemType] })`.
- For a concept class such as `class Quantity extends ConceptAs<number>`, declare `static readonly valueType = Number` (or `String`, `Boolean`, `Guid`, `Date`) so Chronicle knows the serialized value type.
- Name constructor parameters after the fields they assign. The client also inspects constructor parameter names; a parameter such as `t` for a field `title` fails with `Cannot determine the type of BookAdded.t; declare @field with its runtime type`.
- Keep constructors safe to call without arguments. Schema inspection and deserialization construct instances with no arguments and then assign fields, so do not validate or dereference arguments, freeze the instance, or cause side effects in the constructor.

An event type or read model with no members is valid. When a type cannot be resolved, the client reports every unresolved type in one `AggregateError` from `getEventStore(...)`, before anything is registered with the kernel.

```typescript
import 'reflect-metadata';
import { field, ConceptAs } from '@cratis/fundamentals';
import { eventType, getEventTypeJsonSchemaFor } from '@cratis/chronicle/events';

class Quantity extends ConceptAs<number> {
    static readonly valueType = Number;
}

@eventType('stock-counted')
class StockCounted {
    @field(Quantity) quantity: Quantity;

    constructor(quantity: Quantity) { this.quantity = quantity; }
}

const event = new StockCounted(new Quantity(42));
console.log(event.quantity.value);
// 42
console.log(getEventTypeJsonSchemaFor(StockCounted).properties?.quantity.type);
// number
```

:::caution[Constructor parameter properties need default values in 6.7.1]
With legacy decorators, an event such as `constructor(readonly name: string) {}` registers with an empty schema in version 6.7.1: its constructor parameter types are ignored. Appends still store the data, but projections cannot map it. Give every parameter a default value (`readonly name: string = ''`), or declare the properties with `@field(Type)`, which works in both modes.
:::

The TypeScript examples on the shared Chronicle pages are compiled with legacy decorators, and many declare event properties as constructor parameters without default values. Those examples compile, but in 6.7.1 they are affected by the caution above. Examples that use `@field` work in both modes. When you copy an example, rewrite its constructor parameter properties as `@field` fields as shown in the `StockCounted` example.

Import `reflect-metadata` first in your entry point. The client uses it to store decorator metadata, and in legacy mode it must be loaded before any decorated class is evaluated. The client initializes `Symbol.metadata` where the runtime does not provide it.

## Artifact discovery

The client registers every artifact whose decorator has run, so importing a module is enough. On top of that, `ChronicleOptions` has a `discoveryPatterns` option. When it is not empty, the client starts matching those glob patterns against the current working directory as soon as you create it, imports every matching file, and makes `getEventStore` wait for the scan.

The default patterns are `**/*.ts` followed by exclusions such as `!**/node_modules`, `!**/dist`, and `!**/*.spec.ts`. Scanning needs the `glob` package, which `@cratis/chronicle` does not install. The client passes all patterns to `glob`, which does not treat a leading `!` as an exclusion, so in 6.7.1 the exclusions have no effect: the default also imports `.d.ts` and `.spec.ts` files. In a compiled project the default fails in one of two ways:

- Without `glob` installed, `getEventStore` rejects with `Could not load a compatible "glob" function for type discovery.`
- With `glob` installed, Node.js imports your `.ts` source files and fails on the first decorator with `SyntaxError: Invalid or unexpected token`.

Choose one of these:

- **Import your artifacts and pass `discoveryPatterns: []`**, as in this guide. Explicit imports also make it obvious which modules register artifacts.
- **Install `glob` and point positive patterns at exactly the code Node.js should load**, for example `discoveryPatterns: ['dist/**/*.js']` for compiled output. Do not rely on `!` patterns to exclude files.

A model-bound read model with only property decorators, such as `@setFrom` without a class-level `@fromEvent`, is found only by file discovery, and only when its module exports it. With discovery off, querying it fails with `Unknown read model`; give the class a `@fromEvent(...)` decorator or keep discovery on.

## Connecting to Chronicle

`ChronicleOptions.development()` connects to `localhost:35000` over TLS with the development client credentials that the development image accepts. It does not validate the server certificate, which is what lets it accept the image's self-signed certificate.

For any other kernel, build the options from a connection string:

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const options = ChronicleOptions.fromConnectionString(process.env.CHRONICLE_CONNECTION!, { discoveryPatterns: [] });
const client = new ChronicleClient(options);
```

Create one client per process and reuse it. Call `client.dispose()` on shutdown. A disposed client rejects every later call, so create a new one if you need to connect again.

## Connection String Format

```text
chronicle://<client-id>:<client-secret>@chronicle.example.com:35000/?skipTlsValidation=false
chronicle://chronicle.example.com:35000/?apiKey=<api-key>&skipTlsValidation=false
```

:::danger[Set skipTlsValidation=false outside local development]
The TypeScript client skips TLS certificate validation unless the connection string says `skipTlsValidation=false`. That default exists for the development image's self-signed certificate. Against any other server, it leaves the connection open to interception.
:::

[Connect to Chronicle](./connecting.md) covers credentials, TLS, multiple hosts, reconnection, and kernel compatibility.

## Development Mode

```typescript
const options = ChronicleOptions.development({ discoveryPatterns: [] });
```

This is the same as `ChronicleOptions.fromConnectionString('chronicle://chronicle-dev-client:chronicle-dev-secret@localhost:35000', ...)`. The development credentials are public, so use it only against a local development kernel.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `getEventStore` never returns and nothing is logged | The client retries the connection with backoff until it succeeds or the client is disposed, and it logs through OpenTelemetry diagnostics, which are silent by default. Check that the kernel is running and the host, port, TLS settings, and credentials are right. [Connect to Chronicle](./connecting.md#connection-diagnostics) shows how to print the retry log and bound the wait. |
| `Could not load a compatible "glob" function for type discovery.` | Default file discovery is on and `glob` is not installed. See [Artifact discovery](#artifact-discovery). |
| `SyntaxError: Invalid or unexpected token` pointing at a decorator in a `.ts` file | Default file discovery imported your TypeScript source. See [Artifact discovery](#artifact-discovery). |
| `Cannot register artifacts: N schema error(s).` | An event type or read model has a member whose type the client cannot determine. Add `@field(Type)`, and check that constructor parameters are named after their fields. |
| `IncompatibleChronicleServer` | The kernel's gRPC contract does not match this client, or the kernel predates the compatibility check. The client does not retry. Deploy a compatible kernel, then create a new client. |
| A read-model property comes back with its default value | The property is not declared with `@field(Type)`, so the client does not read it back; add `@field(Type)`. Or the event declares its properties as constructor parameters without default values, so it registered with an empty schema; see [Decorator mode and schema types](#decorator-mode-and-schema-types). |
| `findInstanceById` returns `null` right after an append | Projections run asynchronously. Wait with `waitForCompletion()`, or treat the read model as eventually consistent. |
| `TypeError: webidl.util.markAsUncloneable is not a function` on startup | Node.js is older than 22.19. Upgrade Node.js. |
| `tsc` reports `TS2834` or missing exports in `node_modules/@cratis/chronicle.contracts` | `NodeNext` resolution checks the contracts declarations. Set `"skipLibCheck": true`. |

## Where to next

- [Connect to Chronicle](./connecting.md) — credentials, TLS, reconnection, disposal, and kernel compatibility.
- [Chronicle get started](/chronicle/get-started/) — the append, project, react loop with examples in every client.
- [Events and event logs](event-log.md), [Event Types](event-types.md), and [Event Evolution](event-type-migrations.md) — model and evolve your event schema.
- [Reducers](reducers.md), [Reactors](reactors.md), and [Projections](projections.md) — build read models and side effects from your events.
- [Read Models](read-models.md) — query projected state.
- [Event Seeding](seeding.md) and [Transactions](transactions.md) — seed data and unit-of-work semantics.
- [Compliance](compliance/index.md) — PII handling and GDPR erasure.
