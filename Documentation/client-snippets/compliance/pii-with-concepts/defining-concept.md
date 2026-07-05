```typescript
import { pii } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@pii()
class PiiConceptsPersonName extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}
```
