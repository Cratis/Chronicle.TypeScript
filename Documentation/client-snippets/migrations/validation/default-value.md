```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

@eventType('validation-author-registered', 2)
class MigrationsValidationAuthorRegistered {
    constructor(readonly name: string, readonly status: string) {}
}

@eventType('validation-author-registered', 1)
class MigrationsValidationAuthorRegisteredV1 {
    constructor(readonly name: string) {}
}

@eventTypeMigration(MigrationsValidationAuthorRegistered, MigrationsValidationAuthorRegisteredV1)
class MigrationsValidationAuthorRegisteredMigration implements IEventTypeMigration<MigrationsValidationAuthorRegistered, MigrationsValidationAuthorRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsValidationAuthorRegistered, MigrationsValidationAuthorRegisteredV1>): void {
        // name is unchanged between generations — no operation needed for it
        builder.properties(propertyBuilder => propertyBuilder
            .defaultValue('status', 'active'));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsValidationAuthorRegisteredV1, MigrationsValidationAuthorRegistered>): void {
        // status does not exist in generation 1 — no mapping needed
    }
}
```
