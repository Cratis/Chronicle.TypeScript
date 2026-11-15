```typescript
import { eventType, IEventStore, subject } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubjectBillingAddressChanged {
    @field(String) @subject() customerId: string;
    @field(String) street: string;

    constructor(customerId: string, street: string) {
        this.customerId = customerId;
        this.street = street;
    }
}

class SubjectBillingService {
    constructor(private readonly store: IEventStore) {}

    changeAddress(orderId: string, customerId: string, street: string) {
        // No subject option: the subject is the event's @subject() property, customerId.
        // An explicit { subject } option would still take precedence.
        return this.store.eventLog.append(orderId, new SubjectBillingAddressChanged(customerId, street));
    }
}
```
