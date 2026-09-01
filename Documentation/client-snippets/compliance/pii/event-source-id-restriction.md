```typescript
import { pii } from '@cratis/chronicle';

// TypeScript has no dedicated EventSourceId<T> type - the event source identifier is always
// the conventional 'eventSourceId' property. Marking it @pii() throws
// PIINotSupportedOnEventSourceId at decoration time, for the same reason C# forbids [PII] on
// EventSourceId<T>: encrypting it would make its own decryption key unfindable.
class PiiAttrEmployeeId {
    @pii() eventSourceId = '';
}
```
