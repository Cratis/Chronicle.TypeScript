# Seeding

Seeding lets you populate event streams with initial events when your client starts.

## Defining a Seeder

Use `@seeder` on a class that implements `ICanSeedEvents`:

```typescript
import { ICanSeedEvents, IEventSeedingBuilder, eventType, seeder } from '@cratis/chronicle';

@eventType()
class ProjectRegistered {
    constructor(readonly name: string) {}
}

@eventType()
class ProjectRenamed {
    constructor(readonly name: string) {}
}

@seeder()
class InitialProjectSeeder implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder) {
        builder
            .for<ProjectRegistered>('project-1', [
                new ProjectRegistered('Accounting')
            ])
            .forNamespace('Sales')
            .forEventSource('project-2', [
                new ProjectRegistered('Sales'),
                new ProjectRenamed('Sales EMEA')
            ]);
    }
}
```

## Builder API

- `for<TEvent>(eventSourceId, events)` — strongly typed seeding when all events in the collection are the same event class.
- `forEventSource(eventSourceId, events)` — seeding for mixed event classes in one collection.
- `forNamespace(namespace)` — switch to namespace-scoped seeding for subsequent calls.

By default, seeded events are global (applies to all namespaces). Use `forNamespace(...)` for namespace-specific seed data.

## Discovery and Registration

Seeders are discovered as client artifacts (just like reactors and reducers). During event store artifact registration, seed data is sent after observers are registered.
