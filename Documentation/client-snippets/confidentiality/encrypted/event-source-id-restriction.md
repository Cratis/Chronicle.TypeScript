```typescript
import { encrypted } from '@cratis/chronicle';

// TypeScript has no dedicated EventSourceId<T> type - the event source identifier is always
// the conventional 'eventSourceId' property. Marking it @encrypted() throws
// EncryptedNotSupportedOnEventSourceId at decoration time, for the same reason C# forbids
// [Encrypted] on EventSourceId<T>: encrypting it would make its own decryption key unfindable.
class EncryptedAttrPartnerIntegrationConfiguredWithId {
    @encrypted() eventSourceId = '';
}
```
