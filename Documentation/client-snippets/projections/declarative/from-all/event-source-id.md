```typescript title="Map event source id with FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class AccountOpenedDeclarativeAll {
    constructor(readonly ownerName: string) {}
}

export class AccountSummaryDeclarativeAll {
    accountId = '';
    ownerName = '';
}

@projection('', AccountSummaryDeclarativeAll)
export class AccountSummaryDeclarativeAllProjection implements IProjectionFor<AccountSummaryDeclarativeAll> {
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
