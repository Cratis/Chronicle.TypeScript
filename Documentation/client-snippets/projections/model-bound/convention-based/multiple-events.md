```typescript title="Multiple convention events"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ConventionUserProfileCreated {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@eventType()
export class ConventionUserProfileUpdated {
    @field(String) readonly name: string;
    @field(String) readonly email: string;
    @field(String) readonly phone: string;

    constructor(name: string, email: string, phone: string) {
        this.name = name;
        this.email = email;
        this.phone = phone;
    }
}

@fromEvent(ConventionUserProfileCreated)
@fromEvent(ConventionUserProfileUpdated)
export class ConventionUserProfile {
    @field(String) name = '';
    @field(String) email = '';
    @field(String) phone = '';
}
```
