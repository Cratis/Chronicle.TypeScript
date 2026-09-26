```typescript
import { EventContext, eventType, Guid, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingAccountOpened {
    @field(Guid) readonly accountId: Guid;

    constructor(accountId: Guid) {
        this.accountId = accountId;
    }
}

@eventType()
class EventProcessingDepositMade {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class EventProcessingAccountClosed {}

class EventProcessingAccount {
    accountId: Guid = Guid.empty;
    balance = 0;
    isActive = false;
}

@reducer('', undefined, EventProcessingAccount)
class EventProcessingAccountReducer {
    eventProcessingAccountOpened(event: EventProcessingAccountOpened, current: EventProcessingAccount | undefined): EventProcessingAccount {
        return { accountId: event.accountId, balance: 0, isActive: true };
    }

    eventProcessingDepositMade(
        event: EventProcessingDepositMade,
        current: EventProcessingAccount | undefined,
        context: EventContext
    ): EventProcessingAccount | undefined {
        // Skip if account doesn't exist or is not active
        if (!current || !current.isActive) return current;

        return { ...current, balance: current.balance + event.amount };
    }

    eventProcessingAccountClosed(
        event: EventProcessingAccountClosed,
        current: EventProcessingAccount | undefined
    ): EventProcessingAccount | undefined {
        if (!current) return undefined;

        return { ...current, isActive: false };
    }
}
```
