---
title: Seeding
description: Seed events from TypeScript with @seeder classes that Chronicle applies once per namespace.
---

This page shows how to seed events using the Chronicle TypeScript client. The client sends seed data to the Chronicle kernel when you get the event store, and the kernel applies it once per namespace. See [Event Seeding](/chronicle/event-seeding/) for the concept this page assumes.

## Define events

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';

@eventType()
class AccountOpened {
    @field(String) accountId!: string;
    @field(String) ownerName!: string;
    @field(Number) initialBalance!: number;

    constructor(accountId: string, ownerName: string, initialBalance: number) {
        this.accountId = accountId;
        this.ownerName = ownerName;
        this.initialBalance = initialBalance;
    }
}

@eventType()
class FundsDeposited {
    @field(String) accountId!: string;
    @field(Number) amount!: number;

    constructor(accountId: string, amount: number) {
        this.accountId = accountId;
        this.amount = amount;
    }
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

The next examples show only the `seed` method of a seeder class like `AccountSeeder`. Pass several events to `for` to seed them for one event source:

```typescript
seed(builder: IEventSeedingBuilder): void {
    builder.for('account-1', [
        new FundsDeposited('account-1', 500),
        new FundsDeposited('account-1', 250)
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

## When seeding runs

You don't call anything to run a seeder. `client.getEventStore(...)` collects the seed data from every `@seeder` class whose module has been imported and sends it to the kernel with the store's other artifacts. It does this again after a reconnect.

The kernel deduplicates seeded events and applies them once per namespace, so sending the same seed data on every startup does not append duplicates.

To keep seed data out of an environment, don't import the seeder module there. For example, import it only when a development configuration flag is set. With [file discovery](./getting-started.md#artifact-discovery) turned on, make sure no positive pattern matches the seeder file; `!` exclusion patterns have no effect in 6.7.1.

## Best practices

- Keep seed data minimal and deterministic.
- Use clear event source IDs to make debugging easier.
- Group seeders by scenario so you can remove or adjust one without touching the others.
- Import seeder modules only where the seed data belongs, for example behind a development-only configuration check.
- Use `forNamespace` when seed data is tenant-specific or environment-specific to avoid polluting other namespaces.
