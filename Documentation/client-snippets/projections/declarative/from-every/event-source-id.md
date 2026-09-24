```typescript title="Map the event source id"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class AccountOpenedDeclarativeEvery {
    constructor(readonly ownerName: string) {}
}

export class AccountSummaryDeclarativeEvery {
    accountId = '';
    ownerName = '';
}

@projection('', AccountSummaryDeclarativeEvery)
export class AccountSummaryDeclarativeEveryProjection implements IProjectionFor<AccountSummaryDeclarativeEvery> {
    define(builder: IProjectionBuilderFor<AccountSummaryDeclarativeEvery>): void {
        builder
            .from(AccountOpenedDeclarativeEvery)
            .fromEvery(_ => _
                .set(m => m.accountId)
                .toEventSourceId());
    }
}
```
