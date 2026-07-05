```typescript title="Convention-based mapping"
import { eventType, fromEvent, readModel } from '@cratis/chronicle';

@eventType()
class ConventionUserRegistered {
    constructor(
        readonly name: string,
        readonly email: string,
        readonly registeredAt: Date
    ) {}
}

@readModel()
@fromEvent(ConventionUserRegistered)
class ConventionUser {
    name = '';
    email = '';
    registeredAt = new Date();
}
```
