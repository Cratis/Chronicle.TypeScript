```typescript
import { graphProjection, IGraphProjection, IGraphProjectionBuilder } from '@cratis/chronicle';

// Person, Group, MemberOf and the events are the ones declared in the model-bound example.
@graphProjection('Organization')
export class OrganizationGraph implements IGraphProjection {
    define(builder: IGraphProjectionBuilder): void {
        builder
            .node(Person, node => node
                .from(PersonRegistered, from => from.usingKey(event => event.personId))
                .removedWith(PersonRemoved, removed => removed
                    .usingKey(event => event.personId)
                    .detach()))
            .node(Group, node => node
                .from(GroupCreated, from => from.usingKey(event => event.groupId)))
            .edge(MemberOf, Person, Group, edge => edge
                .from(MemberAdded, from => from
                    .usingSourceKey(event => event.personId)
                    .usingTargetKey(event => event.groupId)
                    .set(memberOf => memberOf.since).toEventContextProperty('occurred'))
                .removedWith(MemberRemoved, removed => removed
                    .usingSourceKey(event => event.personId)
                    .usingTargetKey(event => event.groupId)));
    }
}
```
