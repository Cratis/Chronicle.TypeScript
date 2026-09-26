```typescript
import { EventContext, eventType, filterEventsByTag, IEventStore, reactor, tag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
@tag('customer-lifecycle')
class FilterByTagCustomerRegistered {
    @field(String) readonly emailAddress: string;

    constructor(emailAddress: string) {
        this.emailAddress = emailAddress;
    }
}

class FilterByTagCustomerRegistrationService {
    constructor(private readonly store: IEventStore) {}

    async register(eventSourceId: string, emailAddress: string): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new FilterByTagCustomerRegistered(emailAddress),
            { tags: ['vip', 'onboarding'] });
    }
}

@reactor()
@filterEventsByTag('vip')
class FilterByTagVipWelcomeReactor {
    async filterByTagCustomerRegistered(_event: FilterByTagCustomerRegistered, _context: EventContext): Promise<void> {}
}
```
