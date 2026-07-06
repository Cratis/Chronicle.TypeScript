```typescript title="Disable AutoMap"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class AutoMapDisabledAccountRegistered {
    constructor(readonly accountName: string, readonly contactEmail: string) {}
}

@readModel()
class AutoMapDisabledAccount {
    name = '';
    email = '';
    createdAt = new Date(0);
}

@projection('', AutoMapDisabledAccount)
class AutoMapDisabledAccountProjection implements IProjectionFor<AutoMapDisabledAccount> {
    define(builder: IProjectionBuilderFor<AutoMapDisabledAccount>): void {
        builder
            .noAutoMap()
            .from(AutoMapDisabledAccountRegistered, _ => _
                .set(m => m.name).to(e => e.accountName)
                .set(m => m.email).to(e => e.contactEmail)
                .set(m => m.createdAt).toEventContextProperty('occurred'));
    }
}
```
