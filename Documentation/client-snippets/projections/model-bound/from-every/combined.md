```typescript title="Combine specific mappings with every-event metadata"
import { eventType, fromEvent, fromEvery, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class UserRegisteredForEvery {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@eventType()
export class UserNameChangedForEvery {
    @field(String) readonly newName: string;

    constructor(newName: string) {
        this.newName = newName;
    }
}

@eventType()
export class UserEmailChangedForEvery {
    @field(String) readonly newEmail: string;

    constructor(newEmail: string) {
        this.newEmail = newEmail;
    }
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
