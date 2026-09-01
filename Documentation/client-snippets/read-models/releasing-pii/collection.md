```typescript
import { IEventStore } from '@cratis/chronicle';

class ReleasingPiiSupportTicketBatchService {
    constructor(private readonly store: IEventStore) {}

    releaseAll(tickets: ReleasingPiiSupportTicket[]): Promise<ReleasingPiiSupportTicket[]> {
        return this.store.readModels.releaseMany(ReleasingPiiSupportTicket, tickets);
    }
}
```
