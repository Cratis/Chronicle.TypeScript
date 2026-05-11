# Chronicle TypeScript Client

A TypeScript-idiomatic client for [Cratis Chronicle](https://github.com/Cratis/Chronicle) — the open source event-sourcing kernel.

## Overview

`@cratis/chronicle` provides a clean, type-safe TypeScript API for interacting with the Chronicle Kernel. It builds on top of [`@cratis/chronicle.contracts`](https://www.npmjs.com/package/@cratis/chronicle.contracts) (the gRPC contracts package) and exposes idiomatic TypeScript constructs including:

- **Decorators** — `@eventType`, `@readModel`, `@reactor`, `@reducer`, `@constraint`, `@projection`, and model-bound decorators such as `@fromEvent`
- **Value objects** — `EventSequenceNumber`, `EventTypeId`, `EventStoreName`, etc.
- **Fluent client** — `ChronicleClient` → `EventStore` → `EventLog` → `append()`

## Structure

```
Source/          ← @cratis/chronicle TypeScript library
Documentation/   ← User-facing documentation
Samples/
  Console/       ← Plain Node.js console sample application
```

## Prerequisite: Chronicle Running

You need a Chronicle Kernel available before running samples or application code.

The easiest local setup is the development Docker image:

```bash
docker run -p 35000:35000 -p 8080:8080 cratis/chronicle:latest-development
```

## Getting Started

See [Documentation/getting-started.md](./Documentation/getting-started.md) for installation and usage instructions.

## Quick Example

```typescript
import 'reflect-metadata';
import { ChronicleClient, ChronicleOptions, eventType } from '@cratis/chronicle';

@eventType()
class EmployeeHired {
    constructor(readonly firstName: string, readonly lastName: string) {}
}

const client = new ChronicleClient(ChronicleOptions.development());
const store = await client.getEventStore('MyStore');
const result = await store.eventLog.append('employee-123', new EmployeeHired('Jane', 'Doe'));
console.log(`Appended at sequence number ${result.sequenceNumber.value}`);
client.dispose();
```

## Building

```bash
yarn install
yarn workspace @cratis/chronicle compile
```

## Running the Console Sample

```bash
yarn install
yarn workspace @cratis/chronicle-test-console build
yarn workspace @cratis/chronicle-test-console start
```

Set the `CHRONICLE_CONNECTION` environment variable to override the default connection string (`chronicle://localhost:35000`).
