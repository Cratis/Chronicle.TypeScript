```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class ConcurrencyAccountOpened {
    constructor(readonly accountName: string) {}
}

class ConcurrencyBankAccountService {
    constructor(private readonly store: IEventStore) {}

    async openAccount(accountId: string, accountName: string): Promise<void> {
        await this.store.eventLog.append(accountId, new ConcurrencyAccountOpened(accountName), {
            concurrencyScope: {
                sequenceNumber: 42n,
                eventSourceId: true
            }
        });
    }
}
```
