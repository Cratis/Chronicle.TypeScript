```typescript title="Convention-based set mapping"
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
export class UserRegisteredForProfile {
    constructor(readonly name: string, readonly email: string) {}
}

@fromEvent(UserRegisteredForProfile)
export class UserProfile {
    @setFrom(UserRegisteredForProfile)
    name = '';

    @setFrom(UserRegisteredForProfile)
    email = '';
}
```
