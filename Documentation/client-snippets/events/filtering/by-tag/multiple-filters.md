```typescript
import { eventType, filterEventsByTag, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilterByTagMultiCustomerRegistered {
    @field(String) readonly emailAddress: string;

    constructor(emailAddress: string) {
        this.emailAddress = emailAddress;
    }
}

@reactor()
@filterEventsByTag('vip')
@filterEventsByTag('priority')
class FilterByTagMultiPriorityNotificationsReactor {
    async filterByTagMultiCustomerRegistered(_event: FilterByTagMultiCustomerRegistered): Promise<void> {}
}
```
