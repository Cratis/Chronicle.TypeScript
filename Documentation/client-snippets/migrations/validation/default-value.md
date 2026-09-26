```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('validation-author-registered', 2)
class MigrationsValidationAuthorRegistered {
    @field(String) readonly name: string;
    @field(String) readonly status: string;

    constructor(name: string, status: string) {
        this.name = name;
        this.status = status;
    }
}

@eventType('validation-author-registered', 1)
class MigrationsValidationAuthorRegisteredV1 {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
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
