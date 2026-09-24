```typescript title="Custom key"
import { eventType, fromEvent } from '@cratis/chronicle';

@eventType()
export class ConventionUserRegisteredWithKey {
    constructor(
        readonly userId: string,
        readonly name: string,
        readonly email: string
    ) {}
}

@fromEvent(ConventionUserRegisteredWithKey, { key: 'userId' })
export class ConventionUserById {
    name = '';
    email = '';
}
```
