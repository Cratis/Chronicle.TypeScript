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

- **Decorators** — `@eventType`, `@eventTypeMigration`, `@readModel`, `@reactor`, `@reducer`, `@seeder`, `@constraint`, `@projection`, and model-bound decorators such as `@fromEvent`
- **Value objects** — `EventSequenceNumber`, `EventTypeId`, `EventStoreName`, etc.
- **Fluent client** — `ChronicleClient` → `EventStore` → `EventLog` → `append()`

Beyond appending and observing events, the client covers the full Chronicle surface:

- **Transactions** — group appends into a unit of work with a single commit
- **Jobs** — inspect and control long-running kernel jobs
- **Webhooks** — push events to HTTP endpoints
- **Compliance / PII** — classify event data and handle personally identifiable information
- **OpenTelemetry** — built-in metrics and tracing instrumentation

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
docker run -p 35000:35000 cratis/chronicle:latest-development
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
