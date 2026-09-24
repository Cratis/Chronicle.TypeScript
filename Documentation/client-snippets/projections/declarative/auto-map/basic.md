```typescript title="AutoMap by convention"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class AutoMapUserCreated {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
export class AutoMapUserRenamed {
    constructor(readonly name: string) {}
}

export class AutoMapUser {
    name = '';
    email = '';
}

@projection('', AutoMapUser)
export class AutoMapUserProjection implements IProjectionFor<AutoMapUser> {
    define(builder: IProjectionBuilderFor<AutoMapUser>): void {
        builder
            .from(AutoMapUserCreated)
            .from(AutoMapUserRenamed);
    }
}
```
