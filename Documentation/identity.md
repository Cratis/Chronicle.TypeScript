# Identity

Every state change in Chronicle is tied to an *identity* — the user, service, or system that caused it. The `Identity` class captures that information and is sent with every event append as the `CausedBy` field.

## The `Identity` class

```typescript
import { Identity } from '@cratis/chronicle';

// Create a user identity
const identity = new Identity(
    'a1b2c3d4-...',  // subject — unique identifier (e.g. a user's ID or OAuth subject claim)
    'Jane Doe',       // name
    'jane.doe'        // userName (optional, defaults to '')
);

// On-behalf-of chains are supported
const delegatedIdentity = new Identity(
    'service-id-...',
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

### Express middleware example

```typescript
import express from 'express';
import { identityProvider, Identity } from '@cratis/chronicle';

app.use((req, res, next) => {
    const subject = req.auth?.sub ?? 'anonymous';
    const name    = req.auth?.name ?? '[Anonymous]';
    identityProvider.setCurrentIdentity(new Identity(subject, name));
    res.on('finish', () => identityProvider.clearCurrentIdentity());
    next();
});
```

## Implementing a custom provider

If you need to derive the identity from a framework-specific source (e.g. an HTTP context, a gRPC call, a message-bus header), implement `IIdentityProvider`:

```typescript
import { IIdentityProvider, Identity } from '@cratis/chronicle';

class MyIdentityProvider implements IIdentityProvider {
    getCurrent(): Identity {
        return ...; // pull from your context
    }

    setCurrentIdentity(identity: Identity): void { /* ... */ }
    clearCurrentIdentity(): void { /* ... */ }
}
```

Then pass it wherever `IIdentityProvider` is expected, or replace usages of the `identityProvider` singleton with your instance.
