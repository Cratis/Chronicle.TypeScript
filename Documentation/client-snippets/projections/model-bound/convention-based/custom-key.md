```typescript title="Custom key"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ConventionUserRegisteredWithKey {
    @field(String) readonly userId: string;
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(userId: string, name: string, email: string) {
        this.userId = userId;
        this.name = name;
        this.email = email;
    }
}

@fromEvent(ConventionUserRegisteredWithKey, { key: 'userId' })
export class ConventionUserById {
    @field(String) name = '';
    @field(String) email = '';
}
```
