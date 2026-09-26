# Chronicle TypeScript Client

**Event sourcing for TypeScript and Node.js — the idiomatic client for [Cratis Chronicle](https://github.com/Cratis/Chronicle).**

[![npm](https://img.shields.io/npm/v/@cratis/chronicle?label=npm&logo=npm)](https://www.npmjs.com/package/@cratis/chronicle)
[![Build](https://github.com/Cratis/Chronicle.TypeScript/actions/workflows/build.yml/badge.svg)](https://github.com/Cratis/Chronicle.TypeScript/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Cratis/Chronicle.TypeScript/blob/main/LICENSE)
[![Discord](https://img.shields.io/discord/1182595891576717413?label=Discord&logo=discord&logoColor=white)](https://discord.gg/kt4AMpV8WV)

Chronicle is an event-sourcing database and processing runtime with a first-class .NET SDK and additional TypeScript, Kotlin/Java (JVM), and Elixir clients — with a Python client coming soon — plus pluggable storage-provider implementations including MongoDB (default), PostgreSQL, SQL Server, and SQLite. This package is the **TypeScript client**.

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

## Installation

```bash
npm install @cratis/chronicle @cratis/fundamentals reflect-metadata
```

Requirements:

- Node.js 22.19 or later. The `undici` dependency requires it, and the package fails to import on Node.js 20.
- The package ships ES modules only. Use it from an ES module project, or `require()` it on a Node.js version with `require(esm)` support.
- A running Chronicle kernel. The easiest local setup is the development Docker image, published on this machine only:

```bash
docker run -d --name chronicle -p 127.0.0.1:35000:35000 cratis/chronicle:latest-development
```

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

const client = new ChronicleClient(ChronicleOptions.development());
const store = await client.getEventStore('MyStore');
const result = await store.eventLog.append('employee-123', new EmployeeHired('Jane', 'Doe'));
console.log(`Appended at sequence number ${result.sequenceNumber.value}`);
client.dispose();
```

## Decorators and TypeScript configuration

Chronicle decorators work with both TC39 standard decorators (TypeScript 5.2+; do not enable `experimentalDecorators`) and legacy decorators (`experimentalDecorators: true`). Keep `reflect-metadata` imported at your entry point for Chronicle's runtime metadata storage. In standard mode, TypeScript does not emit `design:type` or `design:paramtypes`; declare event and read-model fields with `@field(Type)` from `@cratis/fundamentals` so Chronicle can generate their schemas. For arrays, provide an element type with `@field(Array, { genericArguments: [ItemType] })`. For a `ConceptAs<string>` or `ConceptAs<number>`, declare `static readonly valueType = String`, `Number`, `Boolean`, `Guid`, or `Date` on the concept class. Member-less event types and read models are valid. Unresolved standard-mode types fail on first schema read or during connection before Kernel registration; property decorators support public instance fields, not standard accessors or getters.

Read models are inferred from `@projection('id', Model)`, `@reducer('id', sequenceId, Model)`, or an exported model with `@fromEvent(Event)` or other model-bound property mappings. Their schema comes from the model type; the default identifier is its class name. See [read models](https://github.com/Cratis/Chronicle.TypeScript/blob/main/Documentation/read-models.md) for preserving existing custom identifiers.

Decorated artifacts register when their modules are imported. When the entry file is TypeScript (run through a loader such as `tsx`), the client also scans `**/*.ts` files by default; compiled JavaScript scans nothing unless you set `discoveryPatterns`. See [artifact discovery](https://github.com/Cratis/Chronicle.TypeScript/blob/main/Documentation/getting-started.md#artifact-discovery).

The client skips TLS certificate validation unless the connection string sets `skipTlsValidation=false`. Set it for every server other than a local development kernel; see [Connect to Chronicle](https://github.com/Cratis/Chronicle.TypeScript/blob/main/Documentation/connecting.md).

## Documentation

Read the [TypeScript client documentation](https://www.cratis.io/chronicle/clients/typescript/), starting with [Get started with the TypeScript client](https://www.cratis.io/chronicle/clients/typescript/getting-started/). The [Chronicle documentation](https://www.cratis.io/chronicle/) explains the concepts, with TypeScript examples.

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
