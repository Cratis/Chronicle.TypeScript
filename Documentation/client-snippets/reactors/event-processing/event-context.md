```typescript
import { EventContext, eventType, reactor } from '@cratis/chronicle';

@eventType()
class ReactorAccountClosed {
    constructor(readonly accountId: string) {}
}

@reactor()
class AuditReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async reactorAccountClosed(event: ReactorAccountClosed, context: EventContext): Promise<void> {
        this.writeAudit(event.accountId, context.occurred, context.eventSourceId);
    }

    private writeAudit(accountId: string, occurred: Date, eventSourceId: string): void {}
}
```
