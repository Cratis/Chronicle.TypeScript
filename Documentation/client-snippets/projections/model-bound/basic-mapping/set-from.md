```typescript title="Model-bound set mapping"
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
export class UserRegisteredForContact {
    constructor(readonly name: string, readonly email: string) {}
}

@fromEvent(UserRegisteredForContact)
export class UserContact {
    @setFrom(UserRegisteredForContact, 'email')
    email = '';

    @setFrom(UserRegisteredForContact, 'name')
    name = '';
}
```
