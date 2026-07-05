```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';

@eventType()
class MigrationsRenamePaymentProcessedV1 {
    constructor(readonly oldAmount: number) {}
}

@eventType('payment-processed', 2)
class MigrationsRenamePaymentProcessed {
    constructor(readonly amount: number) {}
}

@eventTypeMigration(MigrationsRenamePaymentProcessed, MigrationsRenamePaymentProcessedV1)
class MigrationsRenamePaymentProcessedMigration implements IEventTypeMigration<MigrationsRenamePaymentProcessed, MigrationsRenamePaymentProcessedV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsRenamePaymentProcessed, MigrationsRenamePaymentProcessedV1>): void {
        builder.properties(pb => pb
            .renamedFrom('amount', 'oldAmount'));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsRenamePaymentProcessedV1, MigrationsRenamePaymentProcessed>): void {
        builder.properties(pb => pb
            .renamedFrom('oldAmount', 'amount'));
    }
}
```
