```typescript title="Convention-based mapping"
import { eventType, fromEvent } from '@cratis/chronicle';

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
    name = '';
    email = '';
    registeredAt = new Date();
}
```
