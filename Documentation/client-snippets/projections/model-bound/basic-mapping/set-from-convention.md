```typescript title="Convention-based set mapping"
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class UserRegisteredForProfile {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@fromEvent(UserRegisteredForProfile)
export class UserProfile {
    @setFrom(UserRegisteredForProfile)
    name = '';

    @setFrom(UserRegisteredForProfile)
    email = '';
}
```
