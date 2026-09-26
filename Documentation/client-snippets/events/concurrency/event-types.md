```typescript
import { eventType, getEventTypeFor, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConcurrencyPaymentProcessed {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class ConcurrencyPaymentFailed {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class ConcurrencyPaymentRefunded {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
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
