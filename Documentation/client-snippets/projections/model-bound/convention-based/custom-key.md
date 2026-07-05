```typescript title="Custom key"
import { eventType, fromEvent, readModel } from '@cratis/chronicle';

@eventType()
class ConventionUserRegisteredWithKey {
    constructor(
        readonly userId: string,
        readonly name: string,
        readonly email: string
    ) {}
}

@readModel()
@fromEvent(ConventionUserRegisteredWithKey, { key: 'userId' })
class ConventionUserById {
    name = '';
    email = '';
}
```
