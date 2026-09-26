```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubjectShippingAddressChanged {
    @field(String) street: string;

    constructor(street: string) {
        this.street = street;
    }
}

class SubjectShippingService {
    constructor(private readonly store: IEventStore) {}

    changeAddress(orderId: string, customerId: string, street: string) {
        return this.store.eventLog.append(
            orderId,
            new SubjectShippingAddressChanged(street),
            { subject: customerId }
        );
    }
}
```
