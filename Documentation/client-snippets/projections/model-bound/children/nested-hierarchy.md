```typescript
import { childrenFrom, eventType, Guid, join, setFrom } from '@cratis/chronicle';

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
export class MbChildrenNestedOrganization {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedOrganizationCreated, 'name')
    name = '';

    @childrenFrom(MbChildrenNestedDepartmentAdded, 'id', 'id')
    departments: MbChildrenNestedDepartment[] = [];
}

export class MbChildrenNestedDepartment {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedDepartmentAdded, 'name')
    @join(MbChildrenNestedDepartmentRenamed, undefined, 'newName') // Joins work on children
    name = '';

    @childrenFrom(MbChildrenNestedTeamAdded, 'id', 'id', 'departmentId') // Nested children
    teams: MbChildrenNestedTeam[] = [];
}

export class MbChildrenNestedTeam {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedTeamAdded, 'name')
    @join(MbChildrenNestedTeamRenamed, undefined, 'newName') // Joins work on nested children too
    name = '';
}
```
