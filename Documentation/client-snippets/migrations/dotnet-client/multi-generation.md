```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('dotnet-client-multi-gen-person-registered', 3)
class MigrationsDotnetClientMultiGenPersonRegistered {
    @field(String) readonly email: string;
    @field(String) readonly firstName: string;
    @field(String) readonly lastName: string;

    constructor(email: string, firstName: string, lastName: string) {
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

@eventType('dotnet-client-multi-gen-person-registered', 2)
class MigrationsDotnetClientMultiGenPersonRegisteredV2 {
    @field(String) readonly email: string;
    @field(String) readonly name: string;

    constructor(email: string, name: string) {
        this.email = email;
        this.name = name;
    }
}

@eventType('dotnet-client-multi-gen-person-registered', 1)
class MigrationsDotnetClientMultiGenPersonRegisteredV1 {
    @field(String) readonly emailAddress: string;
    @field(String) readonly name: string;

    constructor(emailAddress: string, name: string) {
        this.emailAddress = emailAddress;
        this.name = name;
    }
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
