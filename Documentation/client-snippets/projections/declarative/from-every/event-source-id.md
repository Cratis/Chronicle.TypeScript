```typescript title="Map the event source id"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class AccountOpenedDeclarativeEvery {
    constructor(readonly ownerName: string) {}
}

@readModel()
class AccountSummaryDeclarativeEvery {
    accountId = '';
    ownerName = '';
}

@projection('', AccountSummaryDeclarativeEvery)
class AccountSummaryDeclarativeEveryProjection implements IProjectionFor<AccountSummaryDeclarativeEvery> {
    define(builder: IProjectionBuilderFor<AccountSummaryDeclarativeEvery>): void {
        builder
            .from(AccountOpenedDeclarativeEvery)
            .fromEvery(_ => _
                .set(m => m.accountId)
                .toEventSourceId());
    }
}
```
