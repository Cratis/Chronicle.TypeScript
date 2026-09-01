```typescript
import { pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@pii()
class PiiAttrDateOfBirth extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}

// The concept sits one level down, inside a value object.
class PiiAttrVerifiedDateOfBirth {
    dateOfBirth: PiiAttrDateOfBirth = new PiiAttrDateOfBirth('');
    verifiedBy = '';
}

// Chronicle still finds it: dateOfBirth.dateOfBirth is encrypted, verifiedBy is not.
class PiiAttrExpressVerification {
    name = '';
    dateOfBirth: PiiAttrVerifiedDateOfBirth = new PiiAttrVerifiedDateOfBirth();
}
```
