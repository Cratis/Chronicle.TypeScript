```typescript title="Partial event shapes"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ConventionPartialUserRegistered {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}

@eventType()
export class ConventionPartialUserCompleted {
    @field(String) readonly firstName: string;
    @field(String) readonly lastName: string;
    @field(String) readonly phone: string;

    constructor(firstName: string, lastName: string, phone: string) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
    }
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
