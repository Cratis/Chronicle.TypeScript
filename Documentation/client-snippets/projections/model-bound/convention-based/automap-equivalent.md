```typescript title="Model-bound and declarative AutoMap"
import { eventType, fromEvent, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class ConventionEquivalentUserRegistered {
    constructor(readonly name: string, readonly email: string) {}
}

@fromEvent(ConventionEquivalentUserRegistered)
export class ConventionEquivalentUser {
    name = '';
    email = '';
}

@projection('', ConventionEquivalentUser)
export class ConventionEquivalentProjection implements IProjectionFor<ConventionEquivalentUser> {
    define(builder: IProjectionBuilderFor<ConventionEquivalentUser>): void {
        builder.from(ConventionEquivalentUserRegistered);
    }
}
```
