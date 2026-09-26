```typescript
import { EventContext, eventType, onceOnly, reactor, tag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TaggingReactorsCustomerRegistered {
    @field(String) readonly email: string;
    @field(String) readonly name: string;

    constructor(email: string, name: string) {
        this.email = email;
        this.name = name;
    }
}

interface TaggingReactorsWelcomeEmailService {
    sendWelcomeEmail(email: string, name: string): Promise<void>;
}

@reactor()
@tag('Notifications', 'Customer', 'Email')
class TaggingReactorsCustomerNotificationReactor {
    constructor(private readonly emailService: TaggingReactorsWelcomeEmailService) {}

    @onceOnly()
    async taggingReactorsCustomerRegistered(event: TaggingReactorsCustomerRegistered, _context: EventContext): Promise<void> {
        await this.emailService.sendWelcomeEmail(event.email, event.name);
    }
}
```
