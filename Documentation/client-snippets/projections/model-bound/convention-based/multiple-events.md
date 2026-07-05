```typescript title="Multiple convention events"
import { eventType, fromEvent, readModel } from '@cratis/chronicle';

@eventType()
class ConventionUserProfileCreated {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
class ConventionUserProfileUpdated {
    constructor(
        readonly name: string,
        readonly email: string,
        readonly phone: string
    ) {}
}

@readModel()
@fromEvent(ConventionUserProfileCreated)
@fromEvent(ConventionUserProfileUpdated)
class ConventionUserProfile {
    name = '';
    email = '';
    phone = '';
}
```
