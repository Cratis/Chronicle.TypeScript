```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('dotnet-client-person-registered', 2)
class MigrationsDotnetClientSplitPersonRegistered {
    @field(String) readonly firstName: string;
    @field(String) readonly lastName: string;

    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

@eventType('dotnet-client-person-registered', 1)
class MigrationsDotnetClientSplitPersonRegisteredV1 {
    @field(String) readonly fullName: string;

    constructor(fullName: string) {
        this.fullName = fullName;
    }
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
