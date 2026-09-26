```typescript
import { pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@pii('National ID number — sensitive personal identifier')
class PiiConceptsNationalIdNumber extends ConceptAs<string> {
    static readonly valueType = String;

    constructor(value: string) {
        super(value);
    }
}
```
