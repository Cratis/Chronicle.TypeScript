```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EvtSeedingUserRegistered {
    @field(String) readonly email: string;
    @field(String) readonly displayName: string;

    constructor(email: string, displayName: string) {
        this.email = email;
        this.displayName = displayName;
    }
}

@eventType()
class EvtSeedingEmailVerified {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}

@eventType()
class EvtSeedingProfileUpdated {
    @field(String) readonly displayName: string;

    constructor(displayName: string) {
        this.displayName = displayName;
    }
}

@eventType()
class EvtSeedingOrderPlaced {
    @field(String) readonly userId: string;
    @field(Number) readonly amount: number;

    constructor(userId: string, amount: number) {
        this.userId = userId;
        this.amount = amount;
    }
}
```
