```typescript
import { eventType, getEventTypeFor, IEventLog } from '@cratis/chronicle';

@eventType()
class ConcurrencyPaymentProcessed {
    constructor(readonly amount: number) {}
}

@eventType()
class ConcurrencyPaymentFailed {
    constructor(readonly amount: number) {}
}

@eventType()
class ConcurrencyPaymentRefunded {
    constructor(readonly amount: number) {}
}

class ConcurrencyAccountService {
    constructor(private readonly eventLog: IEventLog) {}

    async processPayment(accountId: string, amount: number): Promise<void> {
        // Only check concurrency for payment-related events
        await this.eventLog.append(accountId, new ConcurrencyPaymentProcessed(amount), {
            concurrencyScope: {
                sequenceNumber: 20n,
                eventTypes: [
                    getEventTypeFor(ConcurrencyPaymentProcessed),
                    getEventTypeFor(ConcurrencyPaymentFailed),
                    getEventTypeFor(ConcurrencyPaymentRefunded)
                ]
            }
        });
    }
}
```
