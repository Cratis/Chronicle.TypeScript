```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GroupCreatedForChildEvents {
    @field(String) readonly name: string;
    @field(String) readonly description: string;

    constructor(name: string, description: string) {
        this.name = name;
        this.description = description;
    }
}

@eventType()
class UserAddedToGroupForChildEvents {
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(userId: string, role: string) {
        this.userId = userId;
        this.role = role;
    }
}

@eventType()
class UserRoleChangedForChildEvents {
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(userId: string, role: string) {
        this.userId = userId;
        this.role = role;
    }
}

@eventType()
class UserRemovedFromGroupForChildEvents {
    @field(String) readonly userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }
}
```
