```typescript
import { pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@pii()
class ComplianceClientPersonName extends ConceptAs<string> {
    static readonly valueType = String;

    constructor(value: string) {
        super(value);
    }
}
```
