```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class TransactionalPaymentCaptured {
    constructor(readonly paymentId: string = '', readonly amount: number = 0) {}
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
