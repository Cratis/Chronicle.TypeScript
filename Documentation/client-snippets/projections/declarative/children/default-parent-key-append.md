```typescript
import { IEventStore } from '@cratis/chronicle';

class GroupMembershipWithDefaultParentKey {
    constructor(private readonly eventStore: IEventStore) {}

    addUserToGroup(groupId: string, userId: string, role: string): Promise<unknown> {
        return this.eventStore.eventLog.append(groupId, new UserAddedWithDefaultParentKey(userId, role));
    }
}
```
