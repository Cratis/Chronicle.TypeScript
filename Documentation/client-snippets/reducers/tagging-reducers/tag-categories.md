```typescript
import { reducer, tag } from '@cratis/chronicle';

class TaggingReducersCategoryExamples {
    id = '';
}

@reducer('', undefined, TaggingReducersCategoryExamples)
// By domain
@tag('Sales', 'Inventory', 'Customer')
// By purpose
@tag('Analytics', 'Reporting', 'Dashboard', 'Auditing')
// By stakeholder
@tag('Executive', 'Operations', 'Finance')
// By data type
@tag('Aggregates', 'Summaries', 'Metrics')
class TaggingReducersCategoryExamplesReducer {}
```
