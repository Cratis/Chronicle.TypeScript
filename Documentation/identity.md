---
title: Identity
description: Control which identity the TypeScript client records as the cause of each appended event.
---

See [Correlation, identity, and causation](/chronicle/concepts/correlation-identity-causation/) for what identity means and why Chronicle tracks it. This page covers the TypeScript-specific API in depth. The `Identity` class is sent with every event append as the `CausedBy` field.

## The `Identity` class

```typescript
import { Identity } from '@cratis/chronicle';

// Create a user identity
const identity = new Identity(
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',  // subject — unique identifier (e.g. a user's ID or OAuth subject claim)
    'Jane Doe',       // name
    'jane.doe'        // userName (optional, defaults to '')
);

// On-behalf-of chains are supported
const delegatedIdentity = new Identity(
    'my-service',
    'My Service',
    'my-service',
    identity          // onBehalfOf
);
```

### Well-known statics

| Static | Subject | Description |
|--------|---------|-------------|
| `Identity.system` | `5d032c92-9d5e-41eb-947a-ee5314ed0032` | Default — used when no identity is set. |
| `Identity.notSet` | `1efc9b81-0612-4466-962c-86acc4e9a028` | Sentinel for an explicitly unset identity. |
| `Identity.unknown` | `3321cf62-db16-425e-8173-99fcfefe11dd` | Sentinel for an unknown identity. |

### Removing duplicate subjects

If a `CausedBy` chain contains the same subject more than once (can happen with intermediary services), call `withoutDuplicates()` to collapse duplicates while keeping the first occurrence:

```typescript
const clean = delegatedIdentity.withoutDuplicates();
```

## Setting the identity for a call context

The module exports a singleton `identityProvider` backed by Node.js [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage), so the identity is automatically scoped to the active async call — there is no need to thread it through function signatures.

```typescript
import { identityProvider, Identity } from '@cratis/chronicle';

// Set once at the entry-point of a request / command handler
identityProvider.setCurrentIdentity(new Identity(userId, displayName, userName));

// Anywhere deeper in the same async context, the identity is available:
const identity = identityProvider.getCurrent(); // returns the identity set above

// Reset to Identity.system when the context ends
identityProvider.clearCurrentIdentity();
```

For concurrent or nested operations, prefer `identityProvider.run(identity, callback)`. It isolates the callback and its async children and restores the caller's identity when they finish. `setCurrentIdentity()` remains available for legacy entry points but does not restore a previous identity.

### Express middleware example

This excerpt assumes an Express `app` and an authentication middleware that sets `req.auth` before it runs.

```typescript
import express from 'express';
import { identityProvider, Identity } from '@cratis/chronicle';

app.use((req, res, next) => {
    const subject = req.auth?.sub ?? 'anonymous';
    const name    = req.auth?.name ?? '[Anonymous]';
    identityProvider.run(new Identity(subject, name), () => next());
});
```

## Derive the identity from your framework

The client reads the identity for every append from the exported `identityProvider` singleton. It does not accept another `IIdentityProvider` implementation, so a custom class that implements the interface is never consulted. To take the identity from an HTTP context, a gRPC call, or a message header, read it at the boundary where the work starts and wrap the work in `identityProvider.run(...)`, as the Express example above does.

`IIdentityProvider` describes the read and set operations (`getCurrent()`, `setCurrentIdentity()`, `clearCurrentIdentity()`). Use it to type your own code against the provider, for example to pass `identityProvider` to a function that only needs `getCurrent()`.
