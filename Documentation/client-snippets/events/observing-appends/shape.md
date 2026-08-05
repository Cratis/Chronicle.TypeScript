```typescript
import { AppendedEventWithResult } from '@cratis/chronicle';

// eventLog.appendOperations is an AsyncIterable<AppendedEventWithResult[]> - a hot,
// multicast stream: iterating it yields every batch of events appended through this
// specific event log instance from the moment you start iterating (never for
// transactional appends, and never replayed for a late subscriber).
type ObservingAppendsShape = AsyncIterable<AppendedEventWithResult[]>;
```
