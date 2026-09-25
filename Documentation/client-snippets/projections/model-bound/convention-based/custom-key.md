```typescript title="Custom key"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

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
    @field(String) name = '';
    @field(String) email = '';
}
```
