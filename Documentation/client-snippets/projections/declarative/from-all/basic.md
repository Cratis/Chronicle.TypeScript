```typescript title="Declarative FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class UserCreatedDeclarativeAll {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@eventType()
export class UserEmailChangedDeclarativeAll {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
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
