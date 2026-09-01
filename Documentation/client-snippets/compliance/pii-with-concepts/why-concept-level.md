```typescript
import { eventType, pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

// ❌ Property-level: requires repetition across every event
@eventType()
class PiiConceptsComparisonEmployeeRegistered {
    @pii() name = '';
    department = '';
}

@eventType()
class PiiConceptsComparisonEmployeeNameChanged {
    @pii() newName = ''; // must remember @pii() again
}

// ✅ Concept-level: declare once, apply everywhere automatically
@pii()
class PiiConceptsComparisonPersonName extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}

@eventType()
class PiiConceptsComparisonEmployeeRegisteredGood {
    name: PiiConceptsComparisonPersonName = new PiiConceptsComparisonPersonName(''); // encrypted
    department = '';
}

@eventType()
class PiiConceptsComparisonEmployeeNameChangedGood {
    newName: PiiConceptsComparisonPersonName = new PiiConceptsComparisonPersonName(''); // also encrypted, no extra annotation needed
}
```
