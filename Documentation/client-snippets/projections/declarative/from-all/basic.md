```typescript title="Declarative FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class UserCreatedDeclarativeAll {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
class UserEmailChangedDeclarativeAll {
    constructor(readonly email: string) {}
}

@readModel()
class UserProfileDeclarativeAll {
    name = '';
    email = '';
    lastUpdated = new Date();
}

@projection('', UserProfileDeclarativeAll)
class UserProfileDeclarativeAllProjection implements IProjectionFor<UserProfileDeclarativeAll> {
    define(builder: IProjectionBuilderFor<UserProfileDeclarativeAll>): void {
        builder
            .from(UserCreatedDeclarativeAll)
            .from(UserEmailChangedDeclarativeAll)
            .fromEvery(_ => _
                .set(m => m.lastUpdated)
                .toEventContextProperty('occurred')
                .excludeChildProjections());
    }
}
```
