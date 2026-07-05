```typescript
import { eventType, pii } from '@cratis/chronicle';

@eventType()
class PiiAttrEmployeeRegistered {
    @pii() firstName = '';
    @pii() lastName = '';
    department = '';
}
```
