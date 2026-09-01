```typescript
import { eventType, pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@pii()
class ComplianceClientEmailAddress extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}

@eventType()
class ComplianceClientCustomerRegistered {
    name: ComplianceClientPersonName = new ComplianceClientPersonName('');       // encrypted via concept type
    email: ComplianceClientEmailAddress = new ComplianceClientEmailAddress('');  // encrypted via concept type
    @pii() phoneNumber = '';                                                    // encrypted via property annotation
    country = '';                                                               // plaintext
}
```
