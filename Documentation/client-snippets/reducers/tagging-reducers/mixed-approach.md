```typescript
import { reducer, tag } from '@cratis/chronicle';

class TaggingReducersExecutiveDashboard {
    metricCount = 0;
}

@reducer('', undefined, TaggingReducersExecutiveDashboard)
@tag('Analytics', 'Reporting')
@tag('Executive')
class TaggingReducersExecutiveDashboardReducer {}
```
