```typescript
import { eventType, Guid } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

// ✅ Surrogate key as event source identifier - TypeScript event source identifiers are
// plain strings, so a randomly generated Guid works well with no dedicated identity type
// required.
function createSurrogateEmployeeId(): string {
    return Guid.create().toString();
}

// ✅ Sensitive values stored in PII-marked concept properties instead
@eventType()
class PiiConceptsSurrogateEmployeeRegistered {
    @field(PiiConceptsNationalIdNumber) readonly nationalId: PiiConceptsNationalIdNumber;
    @field(PiiConceptsPersonName) readonly name: PiiConceptsPersonName;

    constructor(nationalId: PiiConceptsNationalIdNumber, name: PiiConceptsPersonName) {
        this.nationalId = nationalId;
        this.name = name;
    }
}
```
