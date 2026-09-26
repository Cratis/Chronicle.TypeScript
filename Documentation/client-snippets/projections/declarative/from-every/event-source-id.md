```typescript title="Map the event source id"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AccountOpenedDeclarativeEvery {
    @field(String) readonly ownerName: string;

    constructor(ownerName: string) {
        this.ownerName = ownerName;
    }
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
