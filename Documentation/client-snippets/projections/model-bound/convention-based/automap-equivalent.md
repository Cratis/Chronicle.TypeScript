```typescript title="Model-bound and declarative AutoMap"
import { eventType, fromEvent, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ConventionEquivalentUserRegistered {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
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
