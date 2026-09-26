```typescript
import { EventContext, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReactorAccountClosed {
    @field(String) readonly accountId: string;

    constructor(accountId: string) {
        this.accountId = accountId;
    }
}

@reactor()
class AuditReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    @onceOnly()
    async reactorAccountClosed(event: ReactorAccountClosed, context: EventContext): Promise<void> {
        this.writeAudit(event.accountId, context.occurred, context.eventSourceId);
    }

    private writeAudit(accountId: string, occurred: Date, eventSourceId: string): void {}
}
```
