```typescript title="AutoMap with explicit mappings"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AutoMapAccountOpened {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@eventType()
export class AutoMapAccountEmailChanged {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
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
