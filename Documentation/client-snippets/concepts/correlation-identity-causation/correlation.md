```typescript
import { correlationIdManager, CorrelationId } from '@cratis/chronicle';

class CorrelationIdentityCausationCorrelation {
    getCurrent(): CorrelationId {
        return correlationIdManager.current;
    }

    setForRequest(): void {
        correlationIdManager.setCurrent(CorrelationId.create());
    }
}
```
