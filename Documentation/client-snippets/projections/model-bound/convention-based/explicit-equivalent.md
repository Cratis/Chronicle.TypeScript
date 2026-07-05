```typescript title="Equivalent explicit mappings"
import { eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class ExplicitConventionUserRegistered {
    constructor(
        readonly name: string,
        readonly email: string,
        readonly registeredAt: Date
    ) {}
}

@readModel()
@fromEvent(ExplicitConventionUserRegistered)
class ExplicitConventionUser {
    @setFrom(ExplicitConventionUserRegistered, 'name')
    name = '';

    @setFrom(ExplicitConventionUserRegistered, 'email')
    email = '';

    @setFrom(ExplicitConventionUserRegistered, 'registeredAt')
    registeredAt = new Date();
}
```
