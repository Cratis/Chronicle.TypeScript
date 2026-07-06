```typescript title="Declarative fromEvery"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class UserCreatedDeclarativeEvery {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
class UserEmailChangedDeclarativeEvery {
    constructor(readonly email: string) {}
}

@readModel()
class UserProfileDeclarativeEvery {
    name = '';
    email = '';
    lastUpdated = new Date();
}

@projection('', UserProfileDeclarativeEvery)
class UserProfileDeclarativeEveryProjection implements IProjectionFor<UserProfileDeclarativeEvery> {
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
