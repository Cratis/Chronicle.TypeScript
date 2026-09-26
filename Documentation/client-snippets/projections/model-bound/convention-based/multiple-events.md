```typescript title="Multiple convention events"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ConventionUserProfileCreated {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
export class ConventionUserProfileUpdated {
    constructor(
        readonly name: string,
        readonly email: string,
        readonly phone: string
    ) {}
}

@fromEvent(ConventionUserProfileCreated)
@fromEvent(ConventionUserProfileUpdated)
export class ConventionUserProfile {
    @field(String) name = '';
    @field(String) email = '';
    @field(String) phone = '';
}
```
