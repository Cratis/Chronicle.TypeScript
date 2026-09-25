# Chronicle TypeScript Client

**Event sourcing for TypeScript and Node.js — the idiomatic client for [Cratis Chronicle](https://github.com/Cratis/Chronicle).**

[![npm](https://img.shields.io/npm/v/@cratis/chronicle?label=npm&logo=npm)](https://www.npmjs.com/package/@cratis/chronicle)
[![Build](https://github.com/Cratis/Chronicle.TypeScript/actions/workflows/build.yml/badge.svg)](https://github.com/Cratis/Chronicle.TypeScript/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1182595891576717413?label=Discord&logo=discord&logoColor=white)](https://discord.gg/kt4AMpV8WV)

Chronicle is an event-sourcing database and processing runtime with a first-class .NET SDK and additional TypeScript, Kotlin/Java (JVM), and Elixir clients — with a Python client coming soon — plus pluggable storage-provider implementations including MongoDB (default), PostgreSQL, SQL Server, and SQLite. This repository is the **TypeScript client**, published to npm as [`@cratis/chronicle`](https://www.npmjs.com/package/@cratis/chronicle).

We believe event sourcing is worth it for almost any system dealing with information and business flows — and that in TypeScript it should feel like TypeScript. This client is designed to be idiomatic — decorators, value objects, and a fluent API — so it reads as familiar code even if you have never event-sourced before, with less friction and boilerplate. It is part of one deliberately simple Cratis ecosystem, designed for productivity, quality, and reliability — AI-friendly by design, with free [AI skills](https://github.com/Cratis/AI) for building with the stack.

## Overview

`@cratis/chronicle` provides a clean, type-safe TypeScript API for interacting with the Chronicle Kernel. It builds on top of [`@cratis/chronicle.contracts`](https://www.npmjs.com/package/@cratis/chronicle.contracts) (the gRPC contracts package) and exposes idiomatic TypeScript constructs including:

- **Decorators** — `@eventType`, `@eventTypeMigration`, `@reactor`, `@reducer`, `@seeder`, `@constraint`, `@projection`, and model-bound decorators such as `@fromEvent`
- **Value objects** — `EventSequenceNumber`, `EventTypeId`, `EventStoreName`, etc.
- **Fluent client** — `ChronicleClient` → `EventStore` → `EventLog` → `append()`

Beyond appending and observing events, the client covers the full Chronicle surface:

- **Transactions** — group appends into a unit of work with a single commit
- **Jobs** — inspect and control long-running kernel jobs
- **Webhooks** — push events to HTTP endpoints
- **Compliance / PII** — classify event data and handle personally identifiable information
- **OpenTelemetry** — built-in metrics and tracing instrumentation

Read models are inferred from `@projection('id', Model)`, `@reducer('id', sequenceId, Model)`, or an exported model with `@fromEvent(Event)` or other model-bound property mappings. Their schema comes from the model type; the default identifier is its class name. See [read models](./Documentation/read-models.md) for preserving existing custom identifiers.

## Structure

```text
Source/          ← @cratis/chronicle TypeScript library
Documentation/   ← User-facing documentation
Samples/
  Console/       ← Plain Node.js console sample application
```

## Prerequisites

- Node.js 22.19 or later. The `undici` dependency requires it, and the package fails to import on Node.js 20.
- A running Chronicle kernel. The easiest local setup is the development Docker image, published on this machine only:

```bash
docker run -d --name chronicle -p 127.0.0.1:35000:35000 cratis/chronicle:latest-development
```

## Getting Started

[Get started with the TypeScript client](./Documentation/getting-started.md) takes you from an empty folder to a program that appends events and reads the projected read model back. Read [Connect to Chronicle](./Documentation/connecting.md) before you connect to anything other than a local development kernel: the client skips TLS certificate validation unless the connection string sets `skipTlsValidation=false`.

## Quick Example

```typescript
import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { ChronicleClient, ChronicleOptions, eventType } from '@cratis/chronicle';

@eventType()
class EmployeeHired {
    @field(String) firstName!: string;
    @field(String) lastName!: string;

    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

// discoveryPatterns: [] relies on this module's imports instead of scanning source files.
const client = new ChronicleClient(ChronicleOptions.development({ discoveryPatterns: [] }));
const store = await client.getEventStore('MyStore');
const result = await store.eventLog.append('employee-123', new EmployeeHired('Jane', 'Doe'));
console.log(`Appended at sequence number ${result.sequenceNumber.value}`);
client.dispose();
```

This example uses standard decorators and top-level `await`, so compile it as an ES module with TypeScript 5.2 or later. The [getting started guide](./Documentation/getting-started.md) shows a working `package.json` and `tsconfig.json`.

## Building

```bash
yarn install
yarn build
yarn workspace @cratis/chronicle test
```

`yarn build` compiles the `@cratis/chronicle` library in `Source/` and the console sample. Build the library before you run the sample; the sample imports it from `Source/dist`.

## Running the Console Sample

With a Chronicle kernel running on `localhost:35000`:

```bash
yarn install
yarn build
yarn workspace @cratis/chronicle-test-console start
```

The sample connects with `ChronicleOptions.development()`. Set the `CHRONICLE_CONNECTION` environment variable to use another connection string. [Samples/Console/README.md](./Samples/Console/README.md) describes what the sample does and its keyboard commands.

## The Cratis ecosystem

This project is part of [Cratis](https://www.cratis.io) — free, MIT-licensed tools for building event-sourced and CQRS applications.

- **[Chronicle](https://github.com/Cratis/Chronicle)** — event-sourcing database and runtime. Orleans-based kernel, pluggable storage (MongoDB default; PostgreSQL, SQL Server, SQLite, in-memory), language-agnostic gRPC contracts. [Docs](https://www.cratis.io/chronicle/)
- **Chronicle clients** — first-class [.NET SDK](https://github.com/Cratis/Chronicle), plus TypeScript (this repository), [Kotlin/Java](https://github.com/Cratis/Chronicle.Kotlin), and [Elixir](https://github.com/Cratis/Chronicle.Elixir); [Python](https://github.com/Cratis/Chronicle.Python) coming soon (pre-alpha). AI agents connect through the [Chronicle MCP server](https://github.com/Cratis/Chronicle.Mcp).
- **[Arc](https://github.com/Cratis/Arc)** — opinionated CQRS framework for ASP.NET Core with commands, queries, validation, authorization, and TypeScript proxy generation. Works without event sourcing. [Docs](https://www.cratis.io/arc/)
- **[Components](https://github.com/Cratis/Components)** — React components aligned with Arc patterns. [Docs](https://www.cratis.io/components/)
- **[CLI](https://github.com/Cratis/cli) + Workbench** — inspect and diagnose Chronicle from the terminal or the browser. [Docs](https://www.cratis.io/cli/)
- **Model-first layer (experimental)** — [Studio](https://github.com/Cratis/Studio), [Screenplay](https://github.com/Cratis/Screenplay), [Stage](https://github.com/Cratis/Stage), [Scene](https://github.com/Cratis/Scene), [Prologue](https://github.com/Cratis/Prologue)
- **Supporting** — [Fundamentals](https://github.com/Cratis/Fundamentals), [Specifications](https://github.com/Cratis/Specifications), [Synopsis](https://github.com/Cratis/Synopsis), [Lens](https://github.com/Cratis/Lens), [Narrator](https://github.com/Cratis/Narrator), and free [AI tooling](https://github.com/Cratis/AI) (preview); [Ensemble](https://github.com/Cratis/Ensemble) coming soon (pre-release)
- **[Samples](https://github.com/Cratis/Samples)** — runnable event sourcing and CQRS samples for the whole stack

Everything Cratis publishes today is MIT licensed and free to use.

---

<div align="center">

*Part of the [Cratis](https://www.cratis.io) platform · Licensed under the [MIT license](LICENSE)*

</div>
