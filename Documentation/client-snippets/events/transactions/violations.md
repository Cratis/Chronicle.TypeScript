```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TransactionalPaymentCaptured {
    @field(String) readonly paymentId: string;
    @field(Number) readonly amount: number;

    constructor(paymentId: string = '', amount: number = 0) {
        this.paymentId = paymentId;
        this.amount = amount;
    }
}

async function commitAndInspectViolations(store: IEventStore): Promise<void> {
    const unitOfWork = store.unitOfWorkManager.begin();

    await store.eventLog.transactional.append(
        'payment-123',
        new TransactionalPaymentCaptured('payment-123', 49.5));

    await unitOfWork.commit();

    // Separate, purpose-built accessors instead of filtering getAppendResults() yourself.
    const constraintViolations = unitOfWork.getConstraintViolations();
    const concurrencyViolations = unitOfWork.getConcurrencyViolations();
    const appendErrors = unitOfWork.getAppendErrors();

    if (constraintViolations.length > 0 || concurrencyViolations.length > 0 || appendErrors.length > 0) {
        // None of the events in this unit of work were persisted - handle the failure.
    }
}
```
