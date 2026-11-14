```typescript
import { follows, fromEdge, graph, GraphViewCardinality, viewKey, viewOf, viewProperty } from '@cratis/chronicle';

@graph('Organization')
@viewOf(() => Group)
export class GroupSummary {
    @viewKey() id = '';
    @viewProperty() name = '';
}

@graph('Organization')
@viewOf(() => Group)
export class GroupMembership {
    @viewKey() id = '';
    @viewProperty() name = '';
    @fromEdge() since = new Date();
}

@graph('Organization')
@viewOf(() => Person)
export class PersonWithGroups {
    @viewKey() id = '';
    @viewProperty() name = '';
    @follows(() => MemberOf, () => GroupMembership) groups: GroupMembership[] = [];
}

@graph('Organization')
@viewOf(() => Person)
export class PersonWithGroup {
    @viewKey() id = '';
    @follows(() => MemberOf, () => GroupSummary, { cardinality: GraphViewCardinality.One }) group: GroupSummary | null = null;
}
```
