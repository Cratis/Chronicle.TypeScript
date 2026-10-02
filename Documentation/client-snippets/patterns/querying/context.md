```typescript
import { DayOfWeek, FacetName, TimeBucket, type FacetSet } from '@cratis/chronicle';

const context: FacetSet = {
    [FacetName.Day]: DayOfWeek.Monday,
    [FacetName.TimeBucket]: TimeBucket.Morning
};
const usualActions = await store.patterns.getUsualActions('user-42', context);
const describingPatterns = await store.patterns.getPatterns('user-42', {
    ...context,
    [FacetName.CommandType]: 'RegisterInvoice'
}, { minimumConfidence: 0.8, maximumResults: 10 });
```
