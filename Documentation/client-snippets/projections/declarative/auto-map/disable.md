```typescript title="Disable AutoMap"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AutoMapDisabledAccountRegistered {
    @field(String) readonly accountName: string;
    @field(String) readonly contactEmail: string;

    constructor(accountName: string, contactEmail: string) {
        this.accountName = accountName;
        this.contactEmail = contactEmail;
    }
}

export class AutoMapDisabledAccount {
    name = '';
    email = '';
    createdAt = new Date(0);
}

@projection('', AutoMapDisabledAccount)
export class AutoMapDisabledAccountProjection implements IProjectionFor<AutoMapDisabledAccount> {
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
