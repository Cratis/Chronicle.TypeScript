```typescript
import { reducer, tag } from '@cratis/chronicle';

class TaggingReducersComplianceReport {
    status = '';
}

@reducer('', undefined, TaggingReducersComplianceReport)
@tag('Analytics')
@tag('Compliance')
@tag('Auditing')
class TaggingReducersComplianceReportReducer {}
```
