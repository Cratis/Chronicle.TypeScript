```typescript title="Convention-based set mapping"
import { eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class UserRegisteredForProfile {
    constructor(readonly name: string, readonly email: string) {}
}

@readModel()
@fromEvent(UserRegisteredForProfile)
class UserProfile {
    @setFrom(UserRegisteredForProfile)
    name = '';

    @setFrom(UserRegisteredForProfile)
    email = '';
}
```
