```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class EvtSeedingUserRegistered {
    constructor(readonly email: string, readonly displayName: string) {}
}

@eventType()
class EvtSeedingEmailVerified {
    constructor(readonly email: string) {}
}

@eventType()
class EvtSeedingProfileUpdated {
    constructor(readonly displayName: string) {}
}

@eventType()
class EvtSeedingOrderPlaced {
    constructor(readonly userId: string, readonly amount: number) {}
}
```
