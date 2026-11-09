```typescript
import { edge, edgeFrom, edgeRemovedWith, edgeSource, edgeTarget, eventType, graph, graphKey, node, nodeFrom, nodeRemovedWith, setFromContext } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class PersonRegistered {
    @field(String) readonly personId: string;
    @field(String) readonly name: string;

    constructor(personId: string, name: string) {
        this.personId = personId;
        this.name = name;
    }
}

@eventType()
export class PersonRemoved {
    @field(String) readonly personId: string;

    constructor(personId: string) {
        this.personId = personId;
    }
}

@eventType()
export class GroupCreated {
    @field(String) readonly groupId: string;
    @field(String) readonly name: string;

    constructor(groupId: string, name: string) {
        this.groupId = groupId;
        this.name = name;
    }
}

@eventType()
export class MemberAdded {
    @field(String) readonly personId: string;
    @field(String) readonly groupId: string;

    constructor(personId: string, groupId: string) {
        this.personId = personId;
        this.groupId = groupId;
    }
}

@eventType()
export class MemberRemoved {
    @field(String) readonly personId: string;
    @field(String) readonly groupId: string;

    constructor(personId: string, groupId: string) {
        this.personId = personId;
        this.groupId = groupId;
    }
}

@graph('Organization')
@node()
@nodeFrom(PersonRegistered, { key: 'personId' })
@nodeRemovedWith(PersonRemoved, { key: 'personId', detach: true })
export class Person {
    @graphKey() personId = '';
    name = '';
}

@graph('Organization')
@node()
@nodeFrom(GroupCreated, { key: 'groupId' })
export class Group {
    @graphKey() groupId = '';
    name = '';
}

@graph('Organization')
@edge('MEMBER_OF')
@edgeFrom(MemberAdded, { sourceKey: 'personId', targetKey: 'groupId' })
@edgeRemovedWith(MemberRemoved, { sourceKey: 'personId', targetKey: 'groupId' })
export class MemberOf {
    @edgeSource(Person) personId = '';
    @edgeTarget(Group) groupId = '';
    @setFromContext(MemberAdded, 'occurred') since = new Date();
}
```
