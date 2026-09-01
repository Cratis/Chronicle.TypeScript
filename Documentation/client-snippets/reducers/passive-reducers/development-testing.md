```typescript
import { reducer } from '@cratis/chronicle';

class PassiveReducersExperimentalMetrics {
    sampleCount = 0;
}

// Kept passive while experimental - flip isActive to true once the metric is trusted
@reducer('', undefined, PassiveReducersExperimentalMetrics, false)
class PassiveReducersExperimentalMetricsReducer {
}
```
