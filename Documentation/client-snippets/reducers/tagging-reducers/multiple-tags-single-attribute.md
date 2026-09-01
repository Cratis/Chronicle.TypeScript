```typescript
import { reducer, tag } from '@cratis/chronicle';

class TaggingReducersSalesReport {
    totalSales = 0;
}

@reducer('', undefined, TaggingReducersSalesReport)
@tag('Analytics', 'Reporting', 'Dashboard')
class TaggingReducersSalesReportReducer {}
```
