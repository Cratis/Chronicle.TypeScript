```typescript title="Model-bound set mapping"
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class UserRegisteredForContact {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@fromEvent(UserRegisteredForContact)
export class UserContact {
    @setFrom(UserRegisteredForContact, 'email')
    email = '';

    @setFrom(UserRegisteredForContact, 'name')
    name = '';
}
```
