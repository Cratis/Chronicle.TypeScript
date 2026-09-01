```typescript
class DecRemoveWithJoinGroupMembership {
    groupId = '';
    groupName = '';
    groupType = '';
    joinedAt = new Date();
    role = '';
}

class DecRemoveWithJoinUserProfile {
    userId = '';
    username = '';
    email = '';
    registeredAt = new Date();
    memberships: DecRemoveWithJoinGroupMembership[] = [];
}

class DecRemoveWithJoinProjectAssignment {
    projectId = '';
    projectName = '';
    priority = '';
    deadline = new Date();
    assignedAt = new Date();
    role = '';
    allocation = 0;
}

class DecRemoveWithJoinDeveloperProfile {
    developerId = '';
    name = '';
    skills: string[] = [];
    onboardedAt = new Date();
    currentProjects: DecRemoveWithJoinProjectAssignment[] = [];
}
```
