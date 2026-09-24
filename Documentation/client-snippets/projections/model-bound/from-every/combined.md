```typescript title="Combine specific mappings with every-event metadata"
import { eventType, fromEvent, fromEvery, setFrom } from '@cratis/chronicle';

@eventType()
export class UserRegisteredForEvery {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
export class UserNameChangedForEvery {
    constructor(readonly newName: string) {}
}

@eventType()
export class UserEmailChangedForEvery {
    constructor(readonly newEmail: string) {}
}

@fromEvent(UserRegisteredForEvery)
@fromEvent(UserNameChangedForEvery)
@fromEvent(UserEmailChangedForEvery)
export class UserProfileFromEvery {
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
