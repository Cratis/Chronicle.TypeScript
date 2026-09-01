```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class ComplianceClientEmployeeRegisteredWithConcept {
    constructor(readonly name: ComplianceClientPersonName, readonly department: string) {}
}

@eventType()
class ComplianceClientEmployeeNameChanged {
    constructor(readonly newName: ComplianceClientPersonName) {} // also encrypted
}
```
