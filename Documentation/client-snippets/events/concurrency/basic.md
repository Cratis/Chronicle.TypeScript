```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConcurrencyAccountOpened {
    @field(String) readonly accountName: string;

    constructor(accountName: string) {
        this.accountName = accountName;
    }
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
