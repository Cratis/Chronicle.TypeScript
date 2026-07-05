```typescript
import { eventType, pii } from '@cratis/chronicle';

@eventType()
class ComplianceClientEmployeeRegistered {
    @pii() firstName = '';
    @pii() lastName = '';
    department = '';
    startDate = new Date();
}
```
