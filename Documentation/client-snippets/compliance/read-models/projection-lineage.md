```typescript
import { eventType, fromEvent, pii } from '@cratis/chronicle';
import { ConceptAs, field } from '@cratis/fundamentals';

@pii()
export class ComplianceReadModelsPersonName extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}

@eventType()
export class ComplianceReadModelsEmployeeRegistered {
    @field(ComplianceReadModelsPersonName) name: ComplianceReadModelsPersonName;
    @field(String) department: string;

    constructor(name: ComplianceReadModelsPersonName, department: string) {
        this.name = name;
        this.department = department;
    }
}

// Chronicle's projection pipeline carries PII lineage automatically from the source event
// property into the read model - no @pii() is needed here even though `name` is a plain
// string. It is still encrypted at rest because it came from a PII-marked event property.
@fromEvent(ComplianceReadModelsEmployeeRegistered)
export class ComplianceReadModelsEmployee {
    @field(String) name = '';
    @field(String) department = '';
}
```
