```typescript
import { eventType } from '@cratis/chronicle';

// User stream events
@eventType()
class DecJoinsUserCreated {
    constructor(readonly name: string, readonly email: string) {}
}

@eventType()
class DecJoinsUserAssignedToGroup {
    constructor(readonly userId: string, readonly groupId: string) {}
}

// Group stream events
@eventType()
class DecJoinsGroupCreated {
    constructor(readonly name: string, readonly description: string) {}
}

@eventType()
class DecJoinsGroupRenamed {
    constructor(readonly newName: string) {}
}
```
