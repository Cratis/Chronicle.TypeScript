```typescript title="AutoMap by convention"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class AutoMapUserCreated {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
class AutoMapUserRenamed {
    constructor(readonly name: string) {}
}

@readModel()
class AutoMapUser {
    name = '';
    email = '';
}

@projection('', AutoMapUser)
class AutoMapUserProjection implements IProjectionFor<AutoMapUser> {
    define(builder: IProjectionBuilderFor<AutoMapUser>): void {
        builder
            .from(AutoMapUserCreated)
            .from(AutoMapUserRenamed);
    }
}
```
