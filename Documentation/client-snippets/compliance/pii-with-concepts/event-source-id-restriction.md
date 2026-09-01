```typescript
import { pii } from '@cratis/chronicle';

// TypeScript has no dedicated EventSourceId<T> type to mark PII on directly - the event
// source identifier is always the conventional 'eventSourceId' property, and marking it
// @pii() throws PIINotSupportedOnEventSourceId for the same reason C# forbids [PII] on a
// concept deriving from EventSourceId<T>.
class PiiConceptsEmployeeId {
    @pii() eventSourceId = '';
}
```
