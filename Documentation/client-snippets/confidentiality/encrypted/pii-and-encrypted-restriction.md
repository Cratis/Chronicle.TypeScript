```typescript
import { pii } from '@cratis/chronicle';
import { encrypted, eventType } from '@cratis/chronicle';

// Throws PIIAndEncryptedCombinedNotSupported at schema-generation time.
@eventType()
class EncryptedAttrCustomerRegistered {
    @pii() @encrypted() someValue = '';
}
```
