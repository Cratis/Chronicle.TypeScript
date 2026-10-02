```typescript
import { FacetName, toDayOfWeek, toTimeBucket } from '@cratis/chronicle';

const mondayMorning = {
    instant: new Date('2026-01-05T09:00:00+02:00'),
    offsetMinutes: 120
};
const invoicePatterns = await store.patterns.getPatternsAt('user-42', mondayMorning, {
    alsoConstraining: { [FacetName.AggregateType]: 'Invoice' }
});
console.log(toDayOfWeek(mondayMorning)); // Monday
console.log(toTimeBucket(mondayMorning)); // Morning
```
