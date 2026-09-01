```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

@eventType('dotnet-client-task-created', 2)
class MigrationsDotnetClientDefaultValueTaskCreated {
    constructor(
        readonly title: string,
        readonly status: string,
        readonly retryCount: number,
        readonly enabled: boolean
    ) {}
}

@eventType('dotnet-client-task-created', 1)
class MigrationsDotnetClientDefaultValueTaskCreatedV1 {
    constructor(readonly title: string) {}
}

@eventTypeMigration(MigrationsDotnetClientDefaultValueTaskCreated, MigrationsDotnetClientDefaultValueTaskCreatedV1)
class MigrationsDotnetClientDefaultValueTaskCreatedMigration implements IEventTypeMigration<MigrationsDotnetClientDefaultValueTaskCreated, MigrationsDotnetClientDefaultValueTaskCreatedV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsDotnetClientDefaultValueTaskCreated, MigrationsDotnetClientDefaultValueTaskCreatedV1>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .defaultValue('status', 'active')
            .defaultValue('retryCount', 0)
            .defaultValue('enabled', true));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsDotnetClientDefaultValueTaskCreatedV1, MigrationsDotnetClientDefaultValueTaskCreated>): void {
        // status, retryCount, and enabled did not exist in generation 1 — nothing to map back
    }
}
```
