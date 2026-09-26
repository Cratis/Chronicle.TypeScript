```typescript title="Map context fields with FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AccountTouchedDeclarativeAll {
    @field(String) readonly reason: string;

    constructor(reason: string) {
        this.reason = reason;
    }
}

export class AccountAuditDeclarativeAll {
    lastUpdated = new Date();
    lastEventSequence = 0n;
    lastCorrelationId = '';
}

@projection('', AccountAuditDeclarativeAll)
export class AccountAuditDeclarativeAllProjection implements IProjectionFor<AccountAuditDeclarativeAll> {
    define(builder: IProjectionBuilderFor<AccountAuditDeclarativeAll>): void {
        builder
            .from(AccountTouchedDeclarativeAll)
            .fromEvery(_ => _
                .set(m => m.lastUpdated).toEventContextProperty('occurred')
                .set(m => m.lastEventSequence).toEventContextProperty('sequenceNumber')
                .set(m => m.lastCorrelationId).toEventContextProperty('correlationId')
                .excludeChildProjections());
    }
}
```
