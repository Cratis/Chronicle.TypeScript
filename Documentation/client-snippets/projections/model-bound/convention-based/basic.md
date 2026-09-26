```typescript title="Convention-based mapping"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ConventionUserRegistered {
    @field(String) readonly name: string;
    @field(String) readonly email: string;
    @field(Date) readonly registeredAt: Date;

    constructor(name: string, email: string, registeredAt: Date) {
        this.name = name;
        this.email = email;
        this.registeredAt = registeredAt;
    }
}

@fromEvent(ConventionUserRegistered)
export class ConventionUser {
    @field(String) name = '';
    @field(String) email = '';
    @field(Date) registeredAt = new Date();
}
```
