```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

@eventType('dotnet-client-multi-gen-person-registered', 3)
class MigrationsDotnetClientMultiGenPersonRegistered {
    constructor(readonly email: string, readonly firstName: string, readonly lastName: string) {}
}

@eventType('dotnet-client-multi-gen-person-registered', 2)
class MigrationsDotnetClientMultiGenPersonRegisteredV2 {
    constructor(readonly email: string, readonly name: string) {}
}

@eventType('dotnet-client-multi-gen-person-registered', 1)
class MigrationsDotnetClientMultiGenPersonRegisteredV1 {
    constructor(readonly emailAddress: string, readonly name: string) {}
}

// Generation 1 → 2: rename emailAddress to email
@eventTypeMigration(MigrationsDotnetClientMultiGenPersonRegisteredV2, MigrationsDotnetClientMultiGenPersonRegisteredV1)
class MigrationsDotnetClientMultiGenPersonRegisteredV1ToV2 implements IEventTypeMigration<MigrationsDotnetClientMultiGenPersonRegisteredV2, MigrationsDotnetClientMultiGenPersonRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsDotnetClientMultiGenPersonRegisteredV2, MigrationsDotnetClientMultiGenPersonRegisteredV1>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .renamedFrom('email', 'emailAddress'));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsDotnetClientMultiGenPersonRegisteredV1, MigrationsDotnetClientMultiGenPersonRegisteredV2>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .renamedFrom('emailAddress', 'email'));
    }
}

// Generation 2 → 3: split name into firstName / lastName
@eventTypeMigration(MigrationsDotnetClientMultiGenPersonRegistered, MigrationsDotnetClientMultiGenPersonRegisteredV2)
class MigrationsDotnetClientMultiGenPersonRegisteredV2ToV3 implements IEventTypeMigration<MigrationsDotnetClientMultiGenPersonRegistered, MigrationsDotnetClientMultiGenPersonRegisteredV2> {
    upcast(builder: IEventMigrationBuilder<MigrationsDotnetClientMultiGenPersonRegistered, MigrationsDotnetClientMultiGenPersonRegisteredV2>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .split('firstName', 'name', ' ', 0)
            .split('lastName', 'name', ' ', 1));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsDotnetClientMultiGenPersonRegisteredV2, MigrationsDotnetClientMultiGenPersonRegistered>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .combine('name', ' ', 'firstName', 'lastName'));
    }
}
```
