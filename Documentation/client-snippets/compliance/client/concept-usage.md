```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ComplianceClientEmployeeRegisteredWithConcept {
    @field(ComplianceClientPersonName) readonly name: ComplianceClientPersonName;
    @field(String) readonly department: string;

    constructor(name: ComplianceClientPersonName, department: string) {
        this.name = name;
        this.department = department;
    }
}

@eventType()
class ComplianceClientEmployeeNameChanged {
    @field(ComplianceClientPersonName) readonly newName: ComplianceClientPersonName;

    constructor(newName: ComplianceClientPersonName) {
        this.newName = newName;
    } // also encrypted
}
```
