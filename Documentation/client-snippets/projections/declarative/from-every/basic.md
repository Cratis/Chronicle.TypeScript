```typescript title="Declarative fromEvery"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class UserCreatedDeclarativeEvery {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@eventType()
export class UserEmailChangedDeclarativeEvery {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}

export class UserProfileDeclarativeEvery {
    name = '';
    email = '';
    lastUpdated = new Date();
}

@projection('', UserProfileDeclarativeEvery)
export class UserProfileDeclarativeEveryProjection implements IProjectionFor<UserProfileDeclarativeEvery> {
    define(builder: IProjectionBuilderFor<UserProfileDeclarativeEvery>): void {
        builder
            .from(UserCreatedDeclarativeEvery)
            .from(UserEmailChangedDeclarativeEvery)
            .fromEvery(_ => _
                .set(m => m.lastUpdated)
                .toEventContextProperty('occurred'));
    }
}
```
