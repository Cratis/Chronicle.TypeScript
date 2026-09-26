```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('dotnet-client-customer-registered', 2)
class MigrationsDotnetClientRenamedFromCustomerRegistered {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}

@eventType('dotnet-client-customer-registered', 1)
class MigrationsDotnetClientRenamedFromCustomerRegisteredV1 {
    @field(String) readonly emailAddress: string;

    constructor(emailAddress: string) {
        this.emailAddress = emailAddress;
    }
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
