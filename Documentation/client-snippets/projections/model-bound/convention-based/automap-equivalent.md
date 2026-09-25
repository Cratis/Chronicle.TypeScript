```typescript title="Model-bound and declarative AutoMap"
import { eventType, fromEvent, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ConventionEquivalentUserRegistered {
    constructor(readonly name: string, readonly email: string) {}
}

@fromEvent(ConventionEquivalentUserRegistered)
export class ConventionEquivalentUser {
    @field(String) name = '';
    @field(String) email = '';
}

@projection('', ConventionEquivalentUser)
export class ConventionEquivalentProjection implements IProjectionFor<ConventionEquivalentUser> {
    define(builder: IProjectionBuilderFor<ConventionEquivalentUser>): void {
        builder.from(ConventionEquivalentUserRegistered);
    }
}
```
