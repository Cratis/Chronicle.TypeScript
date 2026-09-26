```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MigrationsRenamePaymentProcessedV1 {
    @field(Number) readonly oldAmount: number;

    constructor(oldAmount: number) {
        this.oldAmount = oldAmount;
    }
}

@eventType('payment-processed', 2)
class MigrationsRenamePaymentProcessed {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
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
