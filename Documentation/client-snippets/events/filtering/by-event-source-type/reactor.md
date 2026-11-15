```typescript
import { EventContext, eventSourceType, eventType, IEventStore, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilterBySourceTypeAccountOpened {
    @field(String) readonly ownerName: string;

    constructor(ownerName: string) {
        this.ownerName = ownerName;
    }
}

class FilterBySourceTypeAccountService {
    constructor(private readonly store: IEventStore) {}

    async open(eventSourceId: string, ownerName: string): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new FilterBySourceTypeAccountOpened(ownerName),
            { sourceType: 'account' });
    }
}

@reactor()
@eventSourceType('account')
class FilterBySourceTypeAccountWelcomeReactor {
    async filterBySourceTypeAccountOpened(_event: FilterBySourceTypeAccountOpened, _context: EventContext): Promise<void> {}
}
```
