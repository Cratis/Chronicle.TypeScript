```typescript title="Declarative FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class UserCreatedDeclarativeAll {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
export class UserEmailChangedDeclarativeAll {
    constructor(readonly email: string) {}
}

export class UserProfileDeclarativeAll {
    name = '';
    email = '';
    lastUpdated = new Date();
}

@projection('', UserProfileDeclarativeAll)
export class UserProfileDeclarativeAllProjection implements IProjectionFor<UserProfileDeclarativeAll> {
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
