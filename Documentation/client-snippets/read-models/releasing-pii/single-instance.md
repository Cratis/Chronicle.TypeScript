```typescript
import { IEventStore } from '@cratis/chronicle';

class ReleasingPiiSupportTicketService {
    constructor(private readonly store: IEventStore) {}

    release(ticket: ReleasingPiiSupportTicket): Promise<ReleasingPiiSupportTicket> {
        return this.store.readModels.release(ReleasingPiiSupportTicket, ticket);
    }
}
```
