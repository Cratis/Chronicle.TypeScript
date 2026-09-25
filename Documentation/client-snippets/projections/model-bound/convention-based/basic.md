```typescript title="Convention-based mapping"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ConventionUserRegistered {
    constructor(
        readonly name: string,
        readonly email: string,
        readonly registeredAt: Date
    ) {}
}

@fromEvent(ConventionUserRegistered)
export class ConventionUser {
    @field(String) name = '';
    @field(String) email = '';
    @field(Date) registeredAt = new Date();
}
```
