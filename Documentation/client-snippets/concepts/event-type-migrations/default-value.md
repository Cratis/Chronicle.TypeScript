```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';

@eventType()
class MigrationsDefaultValueOrderShippedV1 {
    constructor(readonly trackingNumber: string) {}
}

@eventType('order-shipped', 2)
class MigrationsDefaultValueOrderShipped {
    constructor(
        readonly trackingNumber: string,
        readonly retryCount: number,
        readonly description: string
    ) {}
}

@eventTypeMigration(MigrationsDefaultValueOrderShipped, MigrationsDefaultValueOrderShippedV1)
class MigrationsDefaultValueOrderShippedMigration implements IEventTypeMigration<MigrationsDefaultValueOrderShipped, MigrationsDefaultValueOrderShippedV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsDefaultValueOrderShipped, MigrationsDefaultValueOrderShippedV1>): void {
        builder.properties(pb => pb
            .defaultValue('retryCount', 42)
            .defaultValue('description', 'default string'));
    }

    downcast(_builder: IEventMigrationBuilder<MigrationsDefaultValueOrderShippedV1, MigrationsDefaultValueOrderShipped>): void {
        // retryCount and description did not exist in generation 1 — nothing to map back
    }
}
```
