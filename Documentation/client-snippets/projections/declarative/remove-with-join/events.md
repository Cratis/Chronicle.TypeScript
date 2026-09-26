```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecRemoveWithJoinUserRegistered {
    @field(String) readonly username: string;
    @field(String) readonly email: string;

    constructor(username: string, email: string) {
        this.username = username;
        this.email = email;
    }
}

@eventType()
class DecRemoveWithJoinUserJoinedGroup {
    @field(String) readonly userId: string;
    @field(String) readonly groupId: string;
    @field(String) readonly role: string;

    constructor(userId: string, groupId: string, role: string) {
        this.userId = userId;
        this.groupId = groupId;
        this.role = role;
    }
}

@eventType()
class DecRemoveWithJoinUserLeftGroup {
    @field(String) readonly userId: string;
    @field(String) readonly groupId: string;

    constructor(userId: string, groupId: string) {
        this.userId = userId;
        this.groupId = groupId;
    }
}

@eventType()
class DecRemoveWithJoinGroupCreated {
    @field(String) readonly groupName: string;
    @field(String) readonly groupType: string;

    constructor(groupName: string, groupType: string) {
        this.groupName = groupName;
        this.groupType = groupType;
    }
}

@eventType()
class DecRemoveWithJoinGroupDisbanded {
}

@eventType()
class DecRemoveWithJoinDeveloperOnboarded {
    @field(String) readonly name: string;
    @field(Array, { genericArguments: [String] }) readonly skills: string[];

    constructor(name: string, skills: string[]) {
        this.name = name;
        this.skills = skills;
    }
}

@eventType()
class DecRemoveWithJoinDeveloperAssignedToProject {
    @field(String) readonly developerId: string;
    @field(String) readonly projectId: string;
    @field(String) readonly role: string;
    @field(Number) readonly allocation: number;

    constructor(developerId: string, projectId: string, role: string, allocation: number) {
        this.developerId = developerId;
        this.projectId = projectId;
        this.role = role;
        this.allocation = allocation;
    }
}

@eventType()
class DecRemoveWithJoinDeveloperUnassignedFromProject {
    @field(String) readonly developerId: string;
    @field(String) readonly projectId: string;

    constructor(developerId: string, projectId: string) {
        this.developerId = developerId;
        this.projectId = projectId;
    }
}

@eventType()
class DecRemoveWithJoinProjectInitiated {
    @field(String) readonly projectName: string;
    @field(String) readonly priority: string;
    @field(Date) readonly deadline: Date;

    constructor(projectName: string, priority: string, deadline: Date) {
        this.projectName = projectName;
        this.priority = priority;
        this.deadline = deadline;
    }
}

@eventType()
class DecRemoveWithJoinProjectCancelled {
}

@eventType()
class DecRemoveWithJoinProjectCompleted {
}
```
