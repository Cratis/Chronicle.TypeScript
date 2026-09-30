```typescript
import { eventType, EventSequenceNumber, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConcurrencySafeAccountOpened {
    @field(String) readonly accountName: string;

    constructor(accountName: string) {
        this.accountName = accountName;
    }
}

class ConcurrencyViolationHandler {
    constructor(private readonly store: IEventStore) {}

    async tryOpenAccount(accountId: string, accountName: string): Promise<boolean> {
        const result = await this.store.eventLog.append(accountId, new ConcurrencySafeAccountOpened(accountName), {
            concurrencyScope: {
                sequenceNumber: EventSequenceNumber.beforeFirst.value,
                eventSourceId: true
            }
        });

        const violation = result.concurrencyViolation;
        if (violation) {
            console.log(`Expected sequence ${violation.expectedSequenceNumber.value}, actual was ${violation.actualSequenceNumber.value}`);
            return false;
        }

        return result.isSuccess;
    }
}
```
