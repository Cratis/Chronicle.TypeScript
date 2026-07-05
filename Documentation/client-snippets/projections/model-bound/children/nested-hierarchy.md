```typescript
import { childrenFrom, eventType, Guid, join, readModel, setFrom } from '@cratis/chronicle';

// Events
@eventType()
class MbChildrenNestedOrganizationCreated {
    name = '';
}

@eventType()
class MbChildrenNestedDepartmentAdded {
    id: Guid = Guid.empty;
    name = '';
}

@eventType()
class MbChildrenNestedDepartmentRenamed {
    id: Guid = Guid.empty;
    newName = '';
}

@eventType()
class MbChildrenNestedTeamAdded {
    id: Guid = Guid.empty;
    departmentId: Guid = Guid.empty;
    name = '';
}

@eventType()
class MbChildrenNestedTeamRenamed {
    id: Guid = Guid.empty;
    newName = '';
}

// Read Models - all decorators work at every nesting level
@readModel()
class MbChildrenNestedOrganization {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedOrganizationCreated, 'name')
    name = '';

    @childrenFrom(MbChildrenNestedDepartmentAdded, 'id', 'id')
    departments: MbChildrenNestedDepartment[] = [];
}

class MbChildrenNestedDepartment {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedDepartmentAdded, 'name')
    @join(MbChildrenNestedDepartmentRenamed, undefined, 'newName') // Joins work on children
    name = '';

    @childrenFrom(MbChildrenNestedTeamAdded, 'id', 'id', 'departmentId') // Nested children
    teams: MbChildrenNestedTeam[] = [];
}

class MbChildrenNestedTeam {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNestedTeamAdded, 'name')
    @join(MbChildrenNestedTeamRenamed, undefined, 'newName') // Joins work on nested children too
    name = '';
}
```
