```typescript
import { eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

@eventTypeMigration(MigrationsDotnetClientAuthorRegistered, MigrationsDotnetClientAuthorRegisteredV1)
class MigrationsDotnetClientAuthorRegisteredMigration implements IEventTypeMigration<MigrationsDotnetClientAuthorRegistered, MigrationsDotnetClientAuthorRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsDotnetClientAuthorRegistered, MigrationsDotnetClientAuthorRegisteredV1>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .split('firstName', 'name', ' ', 0)
            .split('lastName', 'name', ' ', 1));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsDotnetClientAuthorRegisteredV1, MigrationsDotnetClientAuthorRegistered>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .combine('name', ' ', 'firstName', 'lastName'));
    }
}
```
