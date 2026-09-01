```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

@eventType('dotnet-client-customer-registered', 2)
class MigrationsDotnetClientRenamedFromCustomerRegistered {
    constructor(readonly email: string) {}
}

@eventType('dotnet-client-customer-registered', 1)
class MigrationsDotnetClientRenamedFromCustomerRegisteredV1 {
    constructor(readonly emailAddress: string) {}
}

@eventTypeMigration(MigrationsDotnetClientRenamedFromCustomerRegistered, MigrationsDotnetClientRenamedFromCustomerRegisteredV1)
class MigrationsDotnetClientRenamedFromCustomerRegisteredMigration implements IEventTypeMigration<MigrationsDotnetClientRenamedFromCustomerRegistered, MigrationsDotnetClientRenamedFromCustomerRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsDotnetClientRenamedFromCustomerRegistered, MigrationsDotnetClientRenamedFromCustomerRegisteredV1>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .renamedFrom('email', 'emailAddress'));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsDotnetClientRenamedFromCustomerRegisteredV1, MigrationsDotnetClientRenamedFromCustomerRegistered>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .renamedFrom('emailAddress', 'email'));
    }
}
```
