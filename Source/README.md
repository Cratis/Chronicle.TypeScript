# Chronicle TypeScript Client

**Event sourcing for TypeScript and Node.js — the idiomatic client for [Cratis Chronicle](https://github.com/Cratis/Chronicle).**

[![npm](https://img.shields.io/npm/v/@cratis/chronicle?label=npm&logo=npm)](https://www.npmjs.com/package/@cratis/chronicle)
[![Build](https://github.com/Cratis/Chronicle.TypeScript/actions/workflows/build.yml/badge.svg)](https://github.com/Cratis/Chronicle.TypeScript/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Cratis/Chronicle.TypeScript/blob/main/LICENSE)
[![Discord](https://img.shields.io/discord/1182595891576717413?label=Discord&logo=discord&logoColor=white)](https://discord.gg/kt4AMpV8WV)

Chronicle is an event-sourcing database and processing runtime with a first-class .NET SDK and additional TypeScript, Kotlin/Java (JVM), and Elixir clients — with a Python client coming soon — plus pluggable storage-provider implementations including MongoDB (default), PostgreSQL, SQL Server, and SQLite. This package is the **TypeScript client**.

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

## Installation

```bash
npm install @cratis/chronicle reflect-metadata
```

You need a Chronicle Kernel available. The easiest local setup is the development Docker image:

```bash
docker run -p 35000:35000 cratis/chronicle:latest-development
```

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

## Documentation

See the [getting started guide](https://github.com/Cratis/Chronicle.TypeScript/blob/main/Documentation/getting-started.md) and the rest of the [documentation](https://github.com/Cratis/Chronicle.TypeScript/tree/main/Documentation) for installation and usage instructions, or visit [cratis.io](https://www.cratis.io/chronicle/).

## The Cratis ecosystem

This package is part of [Cratis](https://www.cratis.io) — free, MIT-licensed tools for building event-sourced and CQRS applications.

- **[Chronicle](https://github.com/Cratis/Chronicle)** — event-sourcing database and runtime. Orleans-based kernel, pluggable storage (MongoDB default; PostgreSQL, SQL Server, SQLite, in-memory), language-agnostic gRPC contracts. [Docs](https://www.cratis.io/chronicle/)
- **Chronicle clients** — first-class [.NET SDK](https://github.com/Cratis/Chronicle), plus [TypeScript](https://github.com/Cratis/Chronicle.TypeScript), [Kotlin/Java](https://github.com/Cratis/Chronicle.Kotlin), and [Elixir](https://github.com/Cratis/Chronicle.Elixir); [Python](https://github.com/Cratis/Chronicle.Python) coming soon (pre-alpha). AI agents connect through the [Chronicle MCP server](https://github.com/Cratis/Chronicle.Mcp).
- **[Arc](https://github.com/Cratis/Arc)** — opinionated CQRS framework for ASP.NET Core with commands, queries, validation, authorization, and TypeScript proxy generation. Works without event sourcing. [Docs](https://www.cratis.io/arc/)
- **[Components](https://github.com/Cratis/Components)** — React components aligned with Arc patterns. [Docs](https://www.cratis.io/components/)
- **[CLI](https://github.com/Cratis/cli) + Workbench** — inspect and diagnose Chronicle from the terminal or the browser. [Docs](https://www.cratis.io/cli/)
- **[Samples](https://github.com/Cratis/Samples)** — runnable event sourcing and CQRS samples for the whole stack

Everything Cratis publishes today is MIT licensed and free to use.

---

<div align="center">

*Part of the [Cratis](https://www.cratis.io) platform · Licensed under the [MIT license](https://github.com/Cratis/Chronicle.TypeScript/blob/main/LICENSE)*

</div>
