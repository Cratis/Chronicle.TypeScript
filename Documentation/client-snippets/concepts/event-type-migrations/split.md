```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MigrationsSplitPersonRegisteredV1 {
    @field(String) readonly fullName: string;

    constructor(fullName: string) {
        this.fullName = fullName;
    }
}

@eventType('person-registered', 2)
class MigrationsSplitPersonRegistered {
    @field(String) readonly firstName: string;
    @field(String) readonly lastName: string;

    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

@eventTypeMigration(MigrationsSplitPersonRegistered, MigrationsSplitPersonRegisteredV1)
class MigrationsSplitPersonRegisteredMigration implements IEventTypeMigration<MigrationsSplitPersonRegistered, MigrationsSplitPersonRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsSplitPersonRegistered, MigrationsSplitPersonRegisteredV1>): void {
        builder.properties(pb => pb
            .split('firstName', 'fullName', ' ', 0) // Gets first part
            .split('lastName', 'fullName', ' ', 1)); // Gets second part
    }

    downcast(builder: IEventMigrationBuilder<MigrationsSplitPersonRegisteredV1, MigrationsSplitPersonRegistered>): void {
        builder.properties(pb => pb
            .combine('fullName', ' ', 'firstName', 'lastName'));
    }
}
```
