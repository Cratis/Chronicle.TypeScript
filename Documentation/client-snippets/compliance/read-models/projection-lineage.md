```typescript
import { eventType, fromEvent, pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@pii()
export class ComplianceReadModelsPersonName extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}

@eventType()
export class ComplianceReadModelsEmployeeRegistered {
    constructor(readonly name: ComplianceReadModelsPersonName, readonly department: string) {}
}

// Chronicle's projection pipeline carries PII lineage automatically from the source event
// property into the read model - no @pii() is needed here even though `name` is a plain
// string. It is still encrypted at rest because it came from a PII-marked event property.
@fromEvent(ComplianceReadModelsEmployeeRegistered)
export class ComplianceReadModelsEmployee {
    name = '';
    department = '';
}
```
