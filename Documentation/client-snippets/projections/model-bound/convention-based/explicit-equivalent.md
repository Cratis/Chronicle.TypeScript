```typescript title="Equivalent explicit mappings"
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ExplicitConventionUserRegistered {
    @field(String) readonly name: string;
    @field(String) readonly email: string;
    @field(Date) readonly registeredAt: Date;

    constructor(name: string, email: string, registeredAt: Date) {
        this.name = name;
        this.email = email;
        this.registeredAt = registeredAt;
    }
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
