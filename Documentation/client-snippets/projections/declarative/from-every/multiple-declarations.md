```typescript title="Multiple fromEvery declarations"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class UserChangedDeclarativeEveryMultiple {
    constructor(readonly name: string) {}
}

@readModel()
class UserAuditDeclarativeEveryMultiple {
    name = '';
    lastUpdated = new Date();
    modifiedBy = '';
}

@projection('', UserAuditDeclarativeEveryMultiple)
class UserAuditDeclarativeEveryMultipleProjection implements IProjectionFor<UserAuditDeclarativeEveryMultiple> {
    define(builder: IProjectionBuilderFor<UserAuditDeclarativeEveryMultiple>): void {
        builder
            .from(UserChangedDeclarativeEveryMultiple)
            .fromEvery(_ => _
                .set(m => m.lastUpdated)
                .toEventContextProperty('occurred'))
            .fromEvery(_ => _
                .set(m => m.modifiedBy)
                .toEventContextProperty('causedBy'));
    }
}
```
