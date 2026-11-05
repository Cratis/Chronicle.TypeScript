TypeScript has no self-reducing read models, so the batch method lives on a reducer class.

```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BatchContext, EventBatch, eventType, observes, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class BatchMoneyDeposited {
    @field(Number) readonly amount: number;

    constructor(amount: number = 0) {
        this.amount = amount;
    }
}

@eventType()
class BatchMoneyWithdrawn {
    @field(Number) readonly amount: number;

    constructor(amount: number = 0) {
        this.amount = amount;
    }
}

class AccountBalance {
    @field(Number) balance = 0;
}

@reducer('account-balance', undefined, AccountBalance)
class AccountBalanceReducer {
    @observes(BatchMoneyDeposited)
    @observes(BatchMoneyWithdrawn)
    reduce(events: EventBatch, current: AccountBalance | undefined, _context: BatchContext): AccountBalance {
        return events.events.reduce((account, entry) => {
            if (entry.is(BatchMoneyDeposited)) return { balance: account.balance + entry.event.amount };
            if (entry.is(BatchMoneyWithdrawn)) return { balance: account.balance - entry.event.amount };
            return account;
        }, current ?? { balance: 0 });
    }
}
```

The batch method is called once per event source in a page, with that event source's events and its stored state.
Return `undefined` to remove the read model. Declare `@batchSize({ maxConcurrency })` on the reducer to limit how
many event sources of a page are reduced at the same time; the default is the number of processors.
