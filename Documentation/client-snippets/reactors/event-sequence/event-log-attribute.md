```typescript
import { EventContext, eventType, Guid, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventSequenceLogReactorOrderPlaced {
    @field(Guid) readonly orderId: Guid;

    constructor(orderId: Guid) {
        this.orderId = orderId;
    }
}

// No eventSequenceId given - observes the default event log
@reactor()
class EventSequenceLocalAuditReactor {
    @onceOnly()
    async eventSequenceLogReactorOrderPlaced(event: EventSequenceLogReactorOrderPlaced, context: EventContext): Promise<void> {
        await this.writeAudit(event.orderId, context.occurred);
    }

    private async writeAudit(orderId: Guid, occurred: Date): Promise<void> {}
}
```
