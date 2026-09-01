```typescript
import { reducer } from '@cratis/chronicle';

class PassiveReducersCustomerBehaviorAnalysis {
    uniqueCustomers = 0;
    averageOrderValue = 0;
    ordersByHour: Record<number, number> = {};
}

@reducer('', undefined, PassiveReducersCustomerBehaviorAnalysis, false)
class PassiveReducersCustomerBehaviorAnalysisReducer {
}
```
