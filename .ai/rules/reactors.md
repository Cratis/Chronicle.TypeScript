---
applyTo: "**/*.ts"
---

# Reactor Instructions

Reactors are the "if this then that" of event sourcing — they observe events and produce side effects. Unlike projections (which build state), reactors *do things*: send emails, trigger commands in other slices, call external APIs.

## IReactor — Marker Interface

`IReactor` is a **marker interface** with no methods to implement. Method dispatch is entirely by convention: the name of each method and its parameter type determine which event it handles.

```typescript
@reactor('my-notifier')
class ProjectRegisteredNotifier implements IReactor {
    async projectRegistered(event: ProjectRegistered, context: EventContext): Promise<void> {
        await this.notifications.notify(`Project '${event.name}' was registered.`);
    }
}
```

## Method Signature

```typescript
async methodName(event: TEvent, context: EventContext): Promise<void>
```

- **First parameter** — the event type. The TypeScript type determines which events the method subscribes to.
- **Second parameter** — `EventContext` (optional). Omit if event metadata is not needed.
- **Return type** — `Promise<void>` (always async).
- **Method name** — can be anything descriptive. The name is for readability, not dispatch.

## Critical Rules

1. **Idempotent** — Reactors may be called more than once for the same event (e.g. during replay or recovery). Design accordingly.
2. **Use event data directly** — Never query the read model back inside a reactor. The event contains all the information you need.
3. **Single responsibility** — Each reactor class should have a focused purpose.
4. **No state** — Reactors should be stateless. Inject dependencies via constructor, but do not store mutable state on the class.
