```typescript title="Map event source id with FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class AccountOpenedDeclarativeAll {
    constructor(readonly ownerName: string) {}
}

@readModel()
class AccountSummaryDeclarativeAll {
    accountId = '';
    ownerName = '';
}

@projection('', AccountSummaryDeclarativeAll)
class AccountSummaryDeclarativeAllProjection implements IProjectionFor<AccountSummaryDeclarativeAll> {
    define(builder: IProjectionBuilderFor<AccountSummaryDeclarativeAll>): void {
        builder
            .from(AccountOpenedDeclarativeAll)
            .fromEvery(_ => _
                .set(m => m.accountId)
                .toEventSourceId()
                .excludeChildProjections());
    }
}
```
