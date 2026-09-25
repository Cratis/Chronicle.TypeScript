```typescript title="Partial event shapes"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

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
    @field(String) email = '';
    @field(String) firstName = '';
    @field(String) lastName = '';
    @field(String) phone = '';
}
```
