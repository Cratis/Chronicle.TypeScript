```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';

@eventType()
class MigrationsSplitPersonRegisteredV1 {
    constructor(readonly fullName: string) {}
}

@eventType('person-registered', 2)
class MigrationsSplitPersonRegistered {
    constructor(
        readonly firstName: string,
        readonly lastName: string
    ) {}
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
