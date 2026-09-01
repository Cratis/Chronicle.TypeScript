```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class DecRemoveWithJoinUserRegistered {
    constructor(readonly username: string, readonly email: string) {}
}

@eventType()
class DecRemoveWithJoinUserJoinedGroup {
    constructor(readonly userId: string, readonly groupId: string, readonly role: string) {}
}

@eventType()
class DecRemoveWithJoinUserLeftGroup {
    constructor(readonly userId: string, readonly groupId: string) {}
}

@eventType()
class DecRemoveWithJoinGroupCreated {
    constructor(readonly groupName: string, readonly groupType: string) {}
}

@eventType()
class DecRemoveWithJoinGroupDisbanded {
}

@eventType()
class DecRemoveWithJoinDeveloperOnboarded {
    constructor(readonly name: string, readonly skills: string[]) {}
}

@eventType()
class DecRemoveWithJoinDeveloperAssignedToProject {
    constructor(
        readonly developerId: string,
        readonly projectId: string,
        readonly role: string,
        readonly allocation: number
    ) {}
}

@eventType()
class DecRemoveWithJoinDeveloperUnassignedFromProject {
    constructor(readonly developerId: string, readonly projectId: string) {}
}

@eventType()
class DecRemoveWithJoinProjectInitiated {
    constructor(readonly projectName: string, readonly priority: string, readonly deadline: Date) {}
}

@eventType()
class DecRemoveWithJoinProjectCancelled {
}

@eventType()
class DecRemoveWithJoinProjectCompleted {
}
```
