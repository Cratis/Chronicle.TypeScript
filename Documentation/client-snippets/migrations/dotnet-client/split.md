```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

@eventType('dotnet-client-person-registered', 2)
class MigrationsDotnetClientSplitPersonRegistered {
    constructor(readonly firstName: string, readonly lastName: string) {}
}

@eventType('dotnet-client-person-registered', 1)
class MigrationsDotnetClientSplitPersonRegisteredV1 {
    constructor(readonly fullName: string) {}
}

@eventTypeMigration(MigrationsDotnetClientSplitPersonRegistered, MigrationsDotnetClientSplitPersonRegisteredV1)
class MigrationsDotnetClientSplitPersonRegisteredMigration implements IEventTypeMigration<MigrationsDotnetClientSplitPersonRegistered, MigrationsDotnetClientSplitPersonRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsDotnetClientSplitPersonRegistered, MigrationsDotnetClientSplitPersonRegisteredV1>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .split('firstName', 'fullName', ' ', 0)
            .split('lastName', 'fullName', ' ', 1));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsDotnetClientSplitPersonRegisteredV1, MigrationsDotnetClientSplitPersonRegistered>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .combine('fullName', ' ', 'firstName', 'lastName'));
    }
}
```
