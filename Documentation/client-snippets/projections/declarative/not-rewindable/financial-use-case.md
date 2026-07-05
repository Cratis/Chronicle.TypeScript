```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecNotRewindablePaymentProcessed {
    paymentId = '';
    amount = 0;
}

class DecNotRewindableLedgerEntry {
    recordedAt = new Date();
    transactionType = '';
}

@projection()
class DecNotRewindableTransactionLedgerProjection implements IProjectionFor<DecNotRewindableLedgerEntry> {
    define(builder: IProjectionBuilderFor<DecNotRewindableLedgerEntry>): void {
        builder
            .notRewindable()
            .autoMap()
            .fromEvery(_ => _
                .set(m => m.recordedAt).toEventContextProperty('occurred'))
            .from(DecNotRewindablePaymentProcessed, _ => _
                .set(m => m.transactionType).toValue('PAYMENT'));
    }
}
```
