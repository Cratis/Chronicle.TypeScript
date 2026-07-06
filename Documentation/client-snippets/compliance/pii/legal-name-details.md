```typescript
import { pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@pii('Full legal name — required for contract identification')
class PiiAttrLegalName extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}
```
