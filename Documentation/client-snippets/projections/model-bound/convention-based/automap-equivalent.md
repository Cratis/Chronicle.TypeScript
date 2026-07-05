```typescript title="Model-bound and declarative AutoMap"
import { eventType, fromEvent, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class ConventionEquivalentUserRegistered {
    constructor(readonly name: string, readonly email: string) {}
}

@readModel()
@fromEvent(ConventionEquivalentUserRegistered)
class ConventionEquivalentUser {
    name = '';
    email = '';
}

@projection('', ConventionEquivalentUser)
class ConventionEquivalentProjection implements IProjectionFor<ConventionEquivalentUser> {
    define(builder: IProjectionBuilderFor<ConventionEquivalentUser>): void {
        builder.from(ConventionEquivalentUserRegistered);
    }
}
```
