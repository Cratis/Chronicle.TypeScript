# Auditing — Causation

Causation records *why* an event was appended — a chain of reasons from the root of a business operation down to the individual command or handler that triggered the append. This chain is stored with every event and enables full audit-trail tracing.

## Concepts

| Type | Role |
|------|------|
| `CausationType` | A named string wrapper identifying the *kind* of operation that caused something. |
| `Causation` | A single node in the chain — a timestamp, a `CausationType`, and a property bag. |
| `ICausationManager` | Interface for reading and mutating the chain in the current call context. |
| `CausationManager` | Default `AsyncLocalStorage`-backed implementation. |

## `CausationType`

```typescript
import { CausationType } from '@cratis/chronicle';

// Built-in types
CausationType.root              // 'Root'     — the process-level root
CausationType.unknown           // 'Unknown'
CausationType.appendEvent       // 'TypeScriptClient.Append'
CausationType.appendManyEvents  // 'TypeScriptClient.AppendMany'

// Custom types
const myType = new CausationType('MyApp.CreateEmployee');
```

## `Causation`

```typescript
import { Causation, CausationType } from '@cratis/chronicle';

const entry = new Causation(
    new Date(),                                  // occurred
    new CausationType('MyApp.CreateEmployee'),   // type
    { employeeId: '123' }                        // properties (string→string map)
);

// Factory for a placeholder
const placeholder = Causation.unknown();
```

## Managing the causation chain

The module exports a singleton `causationManager` that uses Node.js [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) so the chain is scoped automatically to the active async context.

### Reading the current chain

```typescript
import { causationManager } from '@cratis/chronicle';

const chain = causationManager.getCurrentChain();
// chain[0] is always the root causation
// chain[n] are additional entries added in this context
```

### Adding causation

Call `add()` before performing an operation to push a new entry onto the chain:

```typescript
import { causationManager, CausationType } from '@cratis/chronicle';

causationManager.add(
    new CausationType('MyApp.CreateEmployee'),
    { correlatedCommand: 'HireEmployee', tenantId: 'acme' }
);

// Now append an event — the event will carry this entry in its Causation chain
await store.eventLog.append(eventSourceId, new EmployeeHired(...));
```

### Defining the process root

By default the root causation is a bare `CausationType.root` entry. Call `defineRoot()` once at start-up to attach application-specific properties:

```typescript
import { causationManager } from '@cratis/chronicle';

causationManager.defineRoot({
    application: 'hr-service',
    version: '2.1.0'
});
```

### Command-handler middleware example

```typescript
import { causationManager, CausationType } from '@cratis/chronicle';

async function handleCommand(commandName: string, handler: () => Promise<void>) {
    causationManager.add(new CausationType(`MyApp.Command.${commandName}`), {});
    await handler();
}
```

## How causation flows into events

When you call `eventLog.append()` or `eventLog.appendMany()`, the Chronicle client automatically reads `causationManager.getCurrentChain()` and sends the full chain as the `Causation` field of the gRPC request. You do not need to pass it manually.
