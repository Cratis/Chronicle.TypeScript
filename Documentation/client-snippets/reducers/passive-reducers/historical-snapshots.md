```typescript
import { IEventStore } from '@cratis/chronicle';

class PassiveReducersAccountBalance {
    balance = 0;
}

class PassiveReducersHistoricalBalanceService {
    constructor(private readonly store: IEventStore) {}

    // Passive reducer computes state on-demand from historical events
    getBalanceAtDate(accountId: string): Promise<PassiveReducersAccountBalance> {
        return this.store.readModels.getInstanceById(PassiveReducersAccountBalance, accountId);
    }
}
```
