```typescript
import { eventType, filterEventsByTag, reactor } from '@cratis/chronicle';

@eventType()
class FilterByTagMultiCustomerRegistered {
    constructor(readonly emailAddress: string) {}
}

@reactor()
@filterEventsByTag('vip')
@filterEventsByTag('priority')
class FilterByTagMultiPriorityNotificationsReactor {
    async filterByTagMultiCustomerRegistered(_event: FilterByTagMultiCustomerRegistered): Promise<void> {}
}
```
