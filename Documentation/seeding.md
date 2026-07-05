# Seeding

This page shows how to seed events using the Chronicle TypeScript client. Seeding is sent to the Chronicle Server when the event store connects, and the server applies it once per namespace. See [Event Seeding](/chronicle/event-seeding/) for the concept this page assumes.

## Define events

```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class AccountOpened {
    constructor(
        readonly accountId: string,
        readonly ownerName: string,
        readonly initialBalance: number
    ) {}
}

@eventType()
class FundsDeposited {
    constructor(
        readonly accountId: string,
        readonly amount: number
    ) {}
}
```

## Implement a seeder

Decorate a class with `@seeder()`, implement `ICanSeedEvents`, and use the builder's `for`/`forEventSource` to accumulate events:

```typescript
import { seeder, ICanSeedEvents, IEventSeedingBuilder } from '@cratis/chronicle';

@seeder()
class AccountSeeder implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder.for('account-1', [
            new AccountOpened('account-1', 'Alice', 1000)
        ]);
    }
}
```

## Seed multiple events of the same type

```typescript
seed(builder: IEventSeedingBuilder): void {
    builder.for('account-1', [
        new AccountOpened('account-1', 'Alice', 1000)
    ]);
}
```

## Seed mixed event types

Use `forEventSource` to seed several different event types for the same event source:

```typescript
seed(builder: IEventSeedingBuilder): void {
    builder.forEventSource('account-1', [
        new AccountOpened('account-1', 'Alice', 1000),
        new FundsDeposited('account-1', 500)
    ]);
}
```

## Namespace-scoped seed data

By default, seed data applies to all namespaces in the event store. To target a specific namespace, use `forNamespace` to get a scoped builder:

```typescript
seed(builder: IEventSeedingBuilder): void {
    builder
        .forNamespace('production')
        .for('account-1', [new AccountOpened('account-1', 'Alice', 1000)]);
}
```

The scoped builder supports the same `for`/`forEventSource` methods as the top-level builder. Each namespace receives only its own scoped events in addition to any global events.

## Running seeders

Discover and register seeders explicitly through the event store:

```typescript
import { IEventStore } from '@cratis/chronicle';

async function runSeeders(store: IEventStore): Promise<void> {
    await store.seeding.discover();
    await store.seeding.register();
}
```

## How it runs

- Seed batches are sent to the Chronicle Server when the event store connects.
- The server deduplicates seeded events and applies them once per namespace.
- Events are appended in a single batch for efficient startup.

## Best practices

- Keep seed data minimal and deterministic.
- Use clear event source IDs to make debugging easier.
- Group seeders by scenario so you can remove or adjust them easily.
- Only call `store.seeding.discover()`/`.register()` when you want seeding to run — for example, guard it behind a development-only build flag or configuration check.
- Use `forNamespace` when seed data is tenant-specific or environment-specific to avoid polluting other namespaces.
