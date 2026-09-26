```typescript title="AutoMap with a join"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AutoMapEmployeeHired {
    @field(String) readonly employeeName: string;
    @field(String) readonly departmentId: string;

    constructor(employeeName: string, departmentId: string) {
        this.employeeName = employeeName;
        this.departmentId = departmentId;
    }
}

@eventType()
export class AutoMapDepartmentRenamed {
    @field(String) readonly departmentName: string;

    constructor(departmentName: string) {
        this.departmentName = departmentName;
    }
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
