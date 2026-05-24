# Seeding

Seeding lets you populate event streams with initial events when your client starts.

## Defining a Seeder

Use `@seeder` on a class that implements `ICanSeedEvents`:

```typescript
import { ICanSeedEvents, eventType, seeder } from '@cratis/chronicle';

@eventType()
class ProjectRegistered {
    constructor(readonly name: string) {}
}

@seeder()
class InitialProjectSeeder implements ICanSeedEvents {
    seed(builder) {
        builder
            .for('project-1', [
                new ProjectRegistered('Accounting')
            ])
            .forNamespace('Sales')
            .forEventSource('project-2', [
                new ProjectRegistered('Sales')
            ]);
    }
}
```

## Builder API

- `for(eventSourceId, events)` — seed events for an event source.
- `forEventSource(eventSourceId, events)` — seed multiple event types for an event source.
- `forNamespace(namespace)` — switch to namespace-scoped seeding for subsequent calls.

By default, seeded events are global (applies to all namespaces). Use `forNamespace(...)` for namespace-specific seed data.

## Discovery and Registration

Seeders are discovered as client artifacts (just like reactors and reducers). During event store artifact registration, seed data is sent after observers are registered.
