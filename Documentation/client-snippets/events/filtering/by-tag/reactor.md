```typescript
import { EventContext, eventType, filterEventsByTag, IEventStore, reactor, tag } from '@cratis/chronicle';

@eventType()
@tag('customer-lifecycle')
class FilterByTagCustomerRegistered {
    constructor(readonly emailAddress: string) {}
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
