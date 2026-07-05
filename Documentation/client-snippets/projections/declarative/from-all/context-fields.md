```typescript title="Map context fields with FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class AccountTouchedDeclarativeAll {
    constructor(readonly reason: string) {}
}

@readModel()
class AccountAuditDeclarativeAll {
    lastUpdated = new Date();
    lastEventSequence = 0n;
    lastCorrelationId = '';
}

@projection('', AccountAuditDeclarativeAll)
class AccountAuditDeclarativeAllProjection implements IProjectionFor<AccountAuditDeclarativeAll> {
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
