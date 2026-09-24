```typescript title="Partial event shapes"
import { eventType, fromEvent } from '@cratis/chronicle';

@eventType()
export class ConventionPartialUserRegistered {
    constructor(readonly email: string) {}
}

@eventType()
export class ConventionPartialUserCompleted {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly phone: string
    ) {}
}

@fromEvent(ConventionPartialUserRegistered)
@fromEvent(ConventionPartialUserCompleted)
export class ConventionPartialUser {
    email = '';
    firstName = '';
    lastName = '';
    phone = '';
}
```
