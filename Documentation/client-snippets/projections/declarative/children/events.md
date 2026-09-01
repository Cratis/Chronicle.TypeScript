```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class GroupCreatedForChildEvents {
    constructor(readonly name: string, readonly description: string) {}
}

@eventType()
class UserAddedToGroupForChildEvents {
    constructor(readonly userId: string, readonly role: string) {}
}

@eventType()
class UserRoleChangedForChildEvents {
    constructor(readonly userId: string, readonly role: string) {}
}

@eventType()
class UserRemovedFromGroupForChildEvents {
    constructor(readonly userId: string) {}
}
```
