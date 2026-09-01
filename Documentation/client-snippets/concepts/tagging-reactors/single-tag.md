```typescript
import { EventContext, eventType, reactor, tag } from '@cratis/chronicle';

@eventType()
class TaggingReactorsOrderPlaced {
    constructor(readonly customerId: string, readonly orderId: string) {}
}

interface TaggingReactorsEmailService {
    sendOrderConfirmation(customerId: string, orderId: string): Promise<void>;
}

@reactor()
@tag('Notifications')
class TaggingReactorsOrderConfirmationReactor {
    constructor(private readonly emailService: TaggingReactorsEmailService) {}

    async taggingReactorsOrderPlaced(event: TaggingReactorsOrderPlaced, _context: EventContext): Promise<void> {
        await this.emailService.sendOrderConfirmation(event.customerId, event.orderId);
    }
}
```
