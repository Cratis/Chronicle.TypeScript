```typescript
import { eventType, reactor, EventContext } from '@cratis/chronicle';

@eventType()
class ReactorsIndexEmailConfirmed {
    constructor(readonly email: string) {}
}

@reactor()
class ReactorsIndexEmailNotificationsReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async reactorsIndexEmailConfirmed(event: ReactorsIndexEmailConfirmed, context: EventContext): Promise<void> {
        await this.sendConfirmation(event.email, context.occurred);
    }

    private async sendConfirmation(email: string, occurred: Date): Promise<void> {}
}
```
