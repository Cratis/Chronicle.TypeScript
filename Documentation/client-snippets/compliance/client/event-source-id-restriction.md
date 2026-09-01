```typescript
import { pii } from '@cratis/chronicle';

// TypeScript represents the event source identifier as the conventional 'eventSourceId'
// property rather than a dedicated EventSourceId<T> type. Marking it @pii() throws
// PIINotSupportedOnEventSourceId - event source identifiers are required for key lookup and
// cannot be encrypted.
class ComplianceClientCustomerId {
    @pii() eventSourceId = '';
}
```
