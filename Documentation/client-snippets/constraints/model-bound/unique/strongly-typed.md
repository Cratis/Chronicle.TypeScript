```typescript
import { ConceptAs } from '@cratis/fundamentals';
import { eventType, unique } from '@cratis/chronicle';

class CmbEmailAddress extends ConceptAs<string> {
    static readonly valueType = String;
}

@eventType('constraints-model-bound-author-registered')
class CmbAuthorRegistered {
    @unique('UniqueAuthorEmail') email = new CmbEmailAddress('');
}
```
