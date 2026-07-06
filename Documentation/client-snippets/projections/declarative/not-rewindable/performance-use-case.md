```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecNotRewindableApiRequestCompleted {
    endpoint = '';
    statusCode = 0;
    durationMilliseconds: bigint = 0n;
}

class DecNotRewindablePerformanceMetric {
    timestamp = new Date();
}

@projection()
class DecNotRewindablePerformanceMetricProjection implements IProjectionFor<DecNotRewindablePerformanceMetric> {
    define(builder: IProjectionBuilderFor<DecNotRewindablePerformanceMetric>): void {
        builder
            .notRewindable()
            .autoMap()
            .from(DecNotRewindableApiRequestCompleted, _ => _
                .set(m => m.timestamp).toEventContextProperty('occurred'));
    }
}
```
