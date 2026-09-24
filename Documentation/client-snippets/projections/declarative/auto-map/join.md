```typescript title="AutoMap with a join"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class AutoMapEmployeeHired {
    constructor(readonly employeeName: string, readonly departmentId: string) {}
}

@eventType()
export class AutoMapDepartmentRenamed {
    constructor(readonly departmentName: string) {}
}

export class AutoMapEmployee {
    employeeName = '';
    departmentId = '';
    departmentName = '';
}

@projection('', AutoMapEmployee)
export class AutoMapEmployeeProjection implements IProjectionFor<AutoMapEmployee> {
    define(builder: IProjectionBuilderFor<AutoMapEmployee>): void {
        builder
            .from(AutoMapEmployeeHired)
            .join(AutoMapDepartmentRenamed, _ => _
                .on(m => m.departmentId));
    }
}
```
