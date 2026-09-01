```typescript
import { EventContext, eventType, reactor, tag } from '@cratis/chronicle';

@eventType()
class TaggingReactorsCustomerRegistered {
    constructor(readonly email: string, readonly name: string) {}
}

interface TaggingReactorsWelcomeEmailService {
    sendWelcomeEmail(email: string, name: string): Promise<void>;
}

@reactor()
@tag('Notifications', 'Customer', 'Email')
class TaggingReactorsCustomerNotificationReactor {
    constructor(private readonly emailService: TaggingReactorsWelcomeEmailService) {}

    async taggingReactorsCustomerRegistered(event: TaggingReactorsCustomerRegistered, _context: EventContext): Promise<void> {
        await this.emailService.sendWelcomeEmail(event.email, event.name);
    }
}
```
