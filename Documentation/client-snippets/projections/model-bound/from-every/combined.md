```typescript title="Combine specific mappings with every-event metadata"
import { eventType, fromEvent, fromEvery, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class UserRegisteredForEvery {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
class UserNameChangedForEvery {
    constructor(readonly newName: string) {}
}

@eventType()
class UserEmailChangedForEvery {
    constructor(readonly newEmail: string) {}
}

@readModel()
@fromEvent(UserRegisteredForEvery)
@fromEvent(UserNameChangedForEvery)
@fromEvent(UserEmailChangedForEvery)
class UserProfileFromEvery {
    @setFrom(UserRegisteredForEvery, 'name')
    @setFrom(UserNameChangedForEvery, 'newName')
    name = '';

    @setFrom(UserRegisteredForEvery, 'email')
    @setFrom(UserEmailChangedForEvery, 'newEmail')
    email = '';

    @fromEvery(undefined, 'occurred')
    lastUpdated = new Date();
}
```
