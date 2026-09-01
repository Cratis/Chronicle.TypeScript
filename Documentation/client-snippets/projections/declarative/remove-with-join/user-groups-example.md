```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecRemoveWithJoinGroupMembershipProjection implements IProjectionFor<DecRemoveWithJoinUserProfile> {
    define(builder: IProjectionBuilderFor<DecRemoveWithJoinUserProfile>): void {
        builder
            .autoMap()
            .from(DecRemoveWithJoinUserRegistered, _ => _
                .set(m => m.userId).toEventSourceId()
                .set(m => m.registeredAt).toEventContextProperty('occurred'))
            .children<DecRemoveWithJoinGroupMembership>(m => m.memberships, children => children
                .identifiedBy(e => e.groupId)
                .autoMap()
                .from(DecRemoveWithJoinUserJoinedGroup, _ => _
                    .usingParentKey(e => e.userId)
                    .usingKey(e => e.groupId)
                    .set(m => m.joinedAt).toEventContextProperty('occurred'))
                .join(DecRemoveWithJoinGroupCreated, _ => _
                    .on(m => m.groupId))
                .removedWith(DecRemoveWithJoinUserLeftGroup, _ => _
                    .usingKey(e => e.groupId))
                .removedWithJoin(DecRemoveWithJoinGroupDisbanded));
    }
}
```
