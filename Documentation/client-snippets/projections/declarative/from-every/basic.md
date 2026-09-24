```typescript title="Declarative fromEvery"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class UserCreatedDeclarativeEvery {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
export class UserEmailChangedDeclarativeEvery {
    constructor(readonly email: string) {}
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
