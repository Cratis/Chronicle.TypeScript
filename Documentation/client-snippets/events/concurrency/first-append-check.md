```typescript
import { eventType, EventSequenceNumber, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConcurrencyFirstAccountOpened {
    @field(String) readonly accountName: string;

    constructor(accountName: string) {
        this.accountName = accountName;
    }
}

class ConcurrencyFirstAppendService {
    constructor(private readonly store: IEventStore) {}

    async openAccount(accountId: string, accountName: string): Promise<void> {
        // EventSequenceNumber.beforeFirst expects that no event matching the scope exists yet.
        // The client sends it as the kernel's ExpectsNoMatchingEvent condition.
        const result = await this.store.eventLog.append(accountId, new ConcurrencyFirstAccountOpened(accountName), {
            concurrencyScope: {
                sequenceNumber: EventSequenceNumber.beforeFirst.value,
                eventSourceId: true
            }
        });
        if (!result.isSuccess) {
            throw new Error('The account already has events');
        }
    }
}
```
