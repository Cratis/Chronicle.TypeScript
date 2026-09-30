```typescript
import { eventType, getEventTypeFor, IEventLog } from '@cratis/chronicle';

@eventType()
class ConcurrencyAccountValidated {}

@eventType()
class ConcurrencyAccountProcessed {}

class ConcurrencyBatchAccountProcessor {
    constructor(private readonly eventLog: IEventLog) {}

    async processAccountBatch(accountId: string): Promise<void> {
        const results = await this.eventLog.appendMany(accountId, [
            new ConcurrencyAccountValidated(),
            new ConcurrencyAccountProcessed()
        ], {
            concurrencyScope: {
                sequenceNumber: 30n,
                eventTypes: [
                    getEventTypeFor(ConcurrencyAccountProcessed),
                    getEventTypeFor(ConcurrencyAccountValidated)
                ]
            }
        });
        if (results.some(result => !result.isSuccess)) {
            throw new Error('Account batch was not appended');
        }
    }
}
```
