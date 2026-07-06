```typescript title="Partial event shapes"
import { eventType, fromEvent, readModel } from '@cratis/chronicle';

@eventType()
class ConventionPartialUserRegistered {
    constructor(readonly email: string) {}
}

@eventType()
class ConventionPartialUserCompleted {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly phone: string
    ) {}
}

@readModel()
@fromEvent(ConventionPartialUserRegistered)
@fromEvent(ConventionPartialUserCompleted)
class ConventionPartialUser {
    email = '';
    firstName = '';
    lastName = '';
    phone = '';
}
```
