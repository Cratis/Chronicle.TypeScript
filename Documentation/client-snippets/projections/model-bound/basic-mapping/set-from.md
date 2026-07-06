```typescript title="Model-bound set mapping"
import { eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class UserRegisteredForContact {
    constructor(readonly name: string, readonly email: string) {}
}

@readModel()
@fromEvent(UserRegisteredForContact)
class UserContact {
    @setFrom(UserRegisteredForContact, 'email')
    email = '';

    @setFrom(UserRegisteredForContact, 'name')
    name = '';
}
```
