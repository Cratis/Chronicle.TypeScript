```typescript title="Map event source id with FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AccountOpenedDeclarativeAll {
    @field(String) readonly ownerName: string;

    constructor(ownerName: string) {
        this.ownerName = ownerName;
    }
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
