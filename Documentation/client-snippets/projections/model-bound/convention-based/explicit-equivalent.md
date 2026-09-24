```typescript title="Equivalent explicit mappings"
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
export class ExplicitConventionUserRegistered {
    constructor(
        readonly name: string,
        readonly email: string,
        readonly registeredAt: Date
    ) {}
}

@fromEvent(ExplicitConventionUserRegistered)
export class ExplicitConventionUser {
    @setFrom(ExplicitConventionUserRegistered, 'name')
    name = '';

    @setFrom(ExplicitConventionUserRegistered, 'email')
    email = '';

    @setFrom(ExplicitConventionUserRegistered, 'registeredAt')
    registeredAt = new Date();
}
```
