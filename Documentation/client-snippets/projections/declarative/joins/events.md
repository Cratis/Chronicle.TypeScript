```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

// User stream events
@eventType()
class DecJoinsUserCreated {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@eventType()
class DecJoinsUserAssignedToGroup {
    @field(String) readonly userId: string;
    @field(String) readonly groupId: string;

    constructor(userId: string, groupId: string) {
        this.userId = userId;
        this.groupId = groupId;
    }
}

// Group stream events
@eventType()
class DecJoinsGroupCreated {
    @field(String) readonly name: string;
    @field(String) readonly description: string;

    constructor(name: string, description: string) {
        this.name = name;
        this.description = description;
    }
}

@eventType()
class DecJoinsGroupRenamed {
    @field(String) readonly newName: string;

    constructor(newName: string) {
        this.newName = newName;
    }
}
```
