```typescript
import { field } from '@cratis/fundamentals';

class AuditEntryKey {
    @field(String) userId = '';
    @field(Date) timestamp = new Date();
}

class AuditEntryWithCompositeKey {
    @field(AuditEntryKey) id = new AuditEntryKey();
    @field(String) action = '';
    @field(String) details = '';
}
```
