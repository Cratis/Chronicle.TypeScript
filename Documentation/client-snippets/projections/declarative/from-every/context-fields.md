```typescript title="Map multiple context fields"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class AccountTouchedDeclarativeEvery {
    constructor(readonly reason: string) {}
}

export class AccountAuditDeclarativeEvery {
    lastUpdated = new Date();
    lastEventSequence = 0n;
    lastCorrelationId = '';
}

@projection('', AccountAuditDeclarativeEvery)
export class AccountAuditDeclarativeEveryProjection implements IProjectionFor<AccountAuditDeclarativeEvery> {
    define(builder: IProjectionBuilderFor<AccountAuditDeclarativeEvery>): void {
        builder
            .from(AccountTouchedDeclarativeEvery)
            .fromEvery(_ => _
                .set(m => m.lastUpdated).toEventContextProperty('occurred')
                .set(m => m.lastEventSequence).toEventContextProperty('sequenceNumber')
                .set(m => m.lastCorrelationId).toEventContextProperty('correlationId'));
    }
}
```
