```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';

@eventType()
class MigrationsAuthorRegisteredV1 {
    constructor(readonly name: string) {}
}

@eventType('author-registered', 2)
class MigrationsAuthorRegistered {
    constructor(
        readonly firstName: string,
        readonly lastName: string
    ) {}
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
