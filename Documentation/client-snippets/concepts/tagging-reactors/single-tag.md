```typescript
import { EventContext, eventType, onceOnly, reactor, tag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TaggingReactorsOrderPlaced {
    @field(String) readonly customerId: string;
    @field(String) readonly orderId: string;

    constructor(customerId: string, orderId: string) {
        this.customerId = customerId;
        this.orderId = orderId;
    }
}

interface TaggingReactorsEmailService {
    sendOrderConfirmation(customerId: string, orderId: string): Promise<void>;
}

@reactor()
@tag('Notifications')
class TaggingReactorsOrderConfirmationReactor {
    constructor(private readonly emailService: TaggingReactorsEmailService) {}

    @onceOnly()
    async taggingReactorsOrderPlaced(event: TaggingReactorsOrderPlaced, _context: EventContext): Promise<void> {
        await this.emailService.sendOrderConfirmation(event.customerId, event.orderId);
    }
}
```
