```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('dotnet-client-task-created', 2)
class MigrationsDotnetClientDefaultValueTaskCreated {
    @field(String) readonly title: string;
    @field(String) readonly status: string;
    @field(Number) readonly retryCount: number;
    @field(Boolean) readonly enabled: boolean;

    constructor(title: string, status: string, retryCount: number, enabled: boolean) {
        this.title = title;
        this.status = status;
        this.retryCount = retryCount;
        this.enabled = enabled;
    }
}

@eventType('dotnet-client-task-created', 1)
class MigrationsDotnetClientDefaultValueTaskCreatedV1 {
    @field(String) readonly title: string;

    constructor(title: string) {
        this.title = title;
    }
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
