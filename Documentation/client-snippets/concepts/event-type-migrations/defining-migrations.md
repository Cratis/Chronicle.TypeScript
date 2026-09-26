```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('author-registered', 1)
class MigrationsAuthorRegisteredV1 {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType('author-registered', 2)
class MigrationsAuthorRegistered {
    @field(String) readonly firstName: string;
    @field(String) readonly lastName: string;

    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

@eventTypeMigration(MigrationsAuthorRegistered, MigrationsAuthorRegisteredV1)
class MigrationsAuthorRegisteredMigration implements IEventTypeMigration<MigrationsAuthorRegistered, MigrationsAuthorRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsAuthorRegistered, MigrationsAuthorRegisteredV1>): void {
        builder.properties(pb => pb
            .split('firstName', 'name', ' ', 0)
            .split('lastName', 'name', ' ', 1));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsAuthorRegisteredV1, MigrationsAuthorRegistered>): void {
        builder.properties(pb => pb
            .combine('name', ' ', 'firstName', 'lastName'));
    }
}
```
