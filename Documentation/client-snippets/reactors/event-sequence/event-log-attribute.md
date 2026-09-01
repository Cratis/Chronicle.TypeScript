```typescript
import { EventContext, eventType, Guid, reactor } from '@cratis/chronicle';

@eventType()
class EventSequenceLogReactorOrderPlaced {
    constructor(readonly orderId: Guid) {}
}

// No eventSequenceId given - observes the default event log
@reactor()
class EventSequenceLocalAuditReactor {
    async eventSequenceLogReactorOrderPlaced(event: EventSequenceLogReactorOrderPlaced, context: EventContext): Promise<void> {
        await this.writeAudit(event.orderId, context.occurred);
    }

    private async writeAudit(orderId: Guid, occurred: Date): Promise<void> {}
}
```
