# Reactors

Reactors are the "if this then that" of event sourcing — they observe events and produce side effects. Unlike projections (which build state), reactors *do things*: send notifications, trigger commands in other contexts, call external APIs.

## Defining a Reactor

Use the `@reactor` decorator to mark a class as a reactor:

```typescript
import { reactor, EventContext, eventType } from '@cratis/chronicle';

@eventType('aa7faa25-afc1-48d1-8558-716581c0e916', 1)
class EmployeeHired {
    constructor(readonly firstName: string, readonly lastName: string) {}
}

@reactor('hr-notification-reactor')
class HrNotificationReactor {
    async employeeHired(event: EmployeeHired, context: EventContext): Promise<void> {
        console.log(`${event.firstName} ${event.lastName} was hired! (seq: ${context.sequenceNumber})`);
    }
}
```

## Rules for Reactors

1. **Idempotent** — Reactors may be called more than once for the same event (e.g. during replay). Design accordingly.
2. **Use event data directly** — Never query the read model back inside a reactor. The event contains all the information you need.
3. **Single responsibility** — Each reactor class should have a focused purpose.
4. **No state** — Reactors should be stateless. Inject dependencies via the constructor, but do not store mutable state.

## Method Dispatch

Method dispatch is by convention: the first parameter type of each public method determines which events it handles.

```typescript
@reactor('my-reactor')
class MyReactor {
    // Handles EmployeeHired events
    async employeeHired(event: EmployeeHired, context: EventContext): Promise<void> { ... }

    // Handles EmployeePromoted events
    async employeePromoted(event: EmployeePromoted, context: EventContext): Promise<void> { ... }
}
```

The `context` parameter is optional — omit it if you don't need event metadata.
