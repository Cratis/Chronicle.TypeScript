```typescript title="AutoMap with explicit mappings"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class AutoMapAccountOpened {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
export class AutoMapAccountEmailChanged {
    constructor(readonly email: string) {}
}

export class AutoMapAccount {
    name = '';
    email = '';
    status = '';
    createdAt = new Date(0);
}

@projection('', AutoMapAccount)
export class AutoMapAccountProjection implements IProjectionFor<AutoMapAccount> {
    define(builder: IProjectionBuilderFor<AutoMapAccount>): void {
        builder
            .from(AutoMapAccountOpened, _ => _
                .set(m => m.status).toValue('Active')
                .set(m => m.createdAt).toEventContextProperty('occurred'))
            .from(AutoMapAccountEmailChanged);
    }
}
```
