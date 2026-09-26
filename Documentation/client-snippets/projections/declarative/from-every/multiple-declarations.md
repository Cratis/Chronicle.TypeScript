```typescript title="Multiple fromEvery declarations"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class UserChangedDeclarativeEveryMultiple {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

export class UserAuditDeclarativeEveryMultiple {
    name = '';
    lastUpdated = new Date();
    modifiedBy = '';
}

@projection('', UserAuditDeclarativeEveryMultiple)
export class UserAuditDeclarativeEveryMultipleProjection implements IProjectionFor<UserAuditDeclarativeEveryMultiple> {
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
