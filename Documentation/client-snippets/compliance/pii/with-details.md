```typescript
import { pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@pii('Collected under GDPR Art. 6(1)(b) — necessary for contract performance')
class PiiAttrPersonName extends ConceptAs<string> {
    static readonly valueType = String;

    constructor(value: string) {
        super(value);
    }
}
```
