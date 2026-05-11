# Getting Started

## Prerequisite: Chronicle Kernel

You need a running Chronicle Kernel before connecting with the TypeScript client.

The easiest local setup is the development Docker image:

```bash
docker run -p 35000:35000 -p 8080:8080 cratis/chronicle:latest-development
```

## Installation

```bash
yarn add @cratis/chronicle reflect-metadata
```

> **Note:** `reflect-metadata` is required for TypeScript decorators to work at runtime. Import it once at the entry point of your application.

## Setup

Import `reflect-metadata` at the top of your application entry point:

```typescript
import 'reflect-metadata';
```

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

```
chronicle://localhost:35000
chronicle://username:password@chronicle.example.com:35000
```

## Development Mode

For local development, use:

```typescript
const options = ChronicleOptions.development();
```

This connects to `chronicle://localhost:35000` by default.
