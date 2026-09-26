```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('order-shipped', 1)
class MigrationsDefaultValueOrderShippedV1 {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string) {
        this.trackingNumber = trackingNumber;
    }
}

@eventType('order-shipped', 2)
class MigrationsDefaultValueOrderShipped {
    @field(String) readonly trackingNumber: string;
    @field(Number) readonly retryCount: number;
    @field(String) readonly description: string;

    constructor(trackingNumber: string, retryCount: number, description: string) {
        this.trackingNumber = trackingNumber;
        this.retryCount = retryCount;
        this.description = description;
    }
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
