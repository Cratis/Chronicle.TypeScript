```typescript
import { IEventStore } from '@cratis/chronicle';

class ReleasingPiiSupportTicketWatcher {
    constructor(private readonly store: IEventStore) {}

    async start(): Promise<void> {
        for await (const changeset of this.store.readModels.watch(ReleasingPiiSupportTicket)) {
            if (changeset.removed) {
                continue;
            }

            const ticket = await this.store.readModels.release(ReleasingPiiSupportTicket, changeset.readModel);
            console.log(`${changeset.key}: ${ticket.requesterName}`);
        }
    }
}
```
