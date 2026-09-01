```typescript
import { pii } from '@cratis/chronicle';

// Every value this type holds is personal, so mark the type once.
@pii()
class PiiAttrDiagnosis {
    condition = '';
    diagnosedBy = '';
}

// Both condition and diagnosedBy are encrypted wherever a PiiAttrDiagnosis appears.
class PiiAttrPatientRecord {
    name = '';
    diagnosis: PiiAttrDiagnosis = new PiiAttrDiagnosis();
}
```
