```typescript
import { eventType, Guid } from '@cratis/chronicle';

// ✅ Surrogate key as event source identifier - TypeScript event source identifiers are
// plain strings, so a randomly generated Guid works well with no dedicated identity type
// required.
function createSurrogateEmployeeId(): string {
    return Guid.create().toString();
}

// ✅ Sensitive values stored in PII-marked concept properties instead
@eventType()
class PiiConceptsSurrogateEmployeeRegistered {
    constructor(readonly nationalId: PiiConceptsNationalIdNumber, readonly name: PiiConceptsPersonName) {}
}
```
