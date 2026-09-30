```typescript
import { eventType, fromEvent, pii } from '@cratis/chronicle';
import { ConceptAs, field } from '@cratis/fundamentals';

@pii()
export class ComplianceReadModelsPersonName extends ConceptAs<string> {
    static readonly valueType = String;

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

// The kernel encrypts a projected read model from the read model's own schema, so mark the
// personal property with @pii() here as well. Without it, `name` is stored in plain text even
// though it came from a PII-marked event property.
@fromEvent(ComplianceReadModelsEmployeeRegistered)
export class ComplianceReadModelsEmployee {
    @pii() @field(String) name = '';
    @field(String) department = '';
}
```
