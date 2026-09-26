```typescript
import { childrenFrom, eventType, Guid, join, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

// Events
@eventType()
export class MbChildrenNestedOrganizationCreated {
    name = '';
}

@eventType()
export class MbChildrenNestedDepartmentAdded {
    id: Guid = Guid.empty;
    name = '';
}

@eventType()
export class MbChildrenNestedDepartmentRenamed {
    id: Guid = Guid.empty;
    newName = '';
}

@eventType()
export class MbChildrenNestedTeamAdded {
    id: Guid = Guid.empty;
    departmentId: Guid = Guid.empty;
    name = '';
}

@eventType()
export class MbChildrenNestedTeamRenamed {
    id: Guid = Guid.empty;
    newName = '';
}

// Read Models - all decorators work at every nesting level
export class MbChildrenNestedTeam {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedTeamAdded, 'name')
    @join(MbChildrenNestedTeamRenamed, undefined, 'newName') // Joins work on nested children too
    name = '';
}

export class MbChildrenNestedDepartment {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedDepartmentAdded, 'name')
    @join(MbChildrenNestedDepartmentRenamed, undefined, 'newName') // Joins work on children
    name = '';

    @childrenFrom(MbChildrenNestedTeamAdded, 'id', 'id', 'departmentId') // Nested children
    @field(Array, { genericArguments: [MbChildrenNestedTeam] }) teams: MbChildrenNestedTeam[] = [];
}

export class MbChildrenNestedOrganization {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedOrganizationCreated, 'name')
    name = '';

    @childrenFrom(MbChildrenNestedDepartmentAdded, 'id', 'id')
    @field(Array, { genericArguments: [MbChildrenNestedDepartment] }) departments: MbChildrenNestedDepartment[] = [];
}
```
