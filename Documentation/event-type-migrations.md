# Event Type Migrations

Event type migrations let you define explicit upcast and downcast rules between adjacent generations of the same event type.

Use migrations when an event schema changes and you need Chronicle to understand how to move event payloads between generations.

## Define Event Generations

Start by defining two generations of the same event type id:

```typescript
import { eventType } from '@cratis/chronicle';

@eventType('EmployeeRegistered', 1)
class EmployeeRegisteredV1 {
    constructor(readonly fullName: string) {}
}

@eventType('EmployeeRegistered', 2)
class EmployeeRegisteredV2 {
    constructor(readonly firstName: string, readonly lastName: string) {}
}
```

## Define a Migration

Use `@eventTypeMigration` to register a discoverable migration class:

```typescript
import {
    eventTypeMigration,
    IEventTypeMigration,
    IEventMigrationBuilder
} from '@cratis/chronicle';

@eventTypeMigration(EmployeeRegisteredV2, EmployeeRegisteredV1)
class EmployeeRegisteredMigration
    implements IEventTypeMigration<EmployeeRegisteredV2, EmployeeRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<EmployeeRegisteredV2, EmployeeRegisteredV1>): void {
        builder.properties(properties => {
            properties
                .split('firstName', 'fullName', ' ', 0)
                .split('lastName', 'fullName', ' ', 1);
        });
    }

    downcast(builder: IEventMigrationBuilder<EmployeeRegisteredV1, EmployeeRegisteredV2>): void {
        builder.properties(properties => {
            properties.combine('fullName', ' ', 'firstName', 'lastName');
        });
    }
}
```

## Property Migration Operations

Inside `builder.properties(...)`, you can configure:

- `split(targetProperty, sourceProperty, separator, part)`
- `combine(targetProperty, separator, ...sourceProperties)`
- `renamedFrom(targetProperty, sourceProperty)`
- `defaultValue(targetProperty, value)`

## Rules

- Both event classes must be decorated with `@eventType(...)`.
- Both generations must have the same event type id.
- The upgraded generation must be exactly one greater than the previous generation.
- The migration class must be loaded by your application so decorator discovery can register it.

If a migration violates generation adjacency, Chronicle throws `InvalidMigrationGenerationGap`.
