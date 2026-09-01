```typescript
import { IEventStore } from '@cratis/chronicle';

class GroupMembershipWithEventParentKey {
    constructor(private readonly eventStore: IEventStore) {}

    addUserToGroup(userId: string, groupId: string, role: string): Promise<unknown> {
        return this.eventStore.eventLog.append(userId, new UserAddedWithEventParentKey(groupId, userId, role));
    }
}
```
