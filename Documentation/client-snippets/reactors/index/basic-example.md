```typescript
import { eventType, onceOnly, reactor, EventContext } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReactorsIndexEmailConfirmed {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}

@reactor()
class ReactorsIndexEmailNotificationsReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    @onceOnly()
    async reactorsIndexEmailConfirmed(event: ReactorsIndexEmailConfirmed, context: EventContext): Promise<void> {
        await this.sendConfirmation(event.email, context.occurred);
    }

    private async sendConfirmation(email: string, occurred: Date): Promise<void> {}
}
```
