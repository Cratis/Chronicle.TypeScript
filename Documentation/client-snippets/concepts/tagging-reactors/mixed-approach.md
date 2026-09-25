```typescript
import { EventContext, eventType, onceOnly, reactor, tag } from '@cratis/chronicle';

@eventType()
class TaggingReactorsOrderShipped {
    constructor(readonly phoneNumber: string, readonly trackingNumber: string) {}
}

interface TaggingReactorsSmsService {
    sendShippingNotification(phoneNumber: string, trackingNumber: string): Promise<void>;
}

@reactor()
@tag('Notifications', 'SMS')
@tag('Customer')
class TaggingReactorsSmsNotificationReactor {
    constructor(private readonly smsService: TaggingReactorsSmsService) {}

    @onceOnly()
    async taggingReactorsOrderShipped(event: TaggingReactorsOrderShipped, _context: EventContext): Promise<void> {
        await this.smsService.sendShippingNotification(event.phoneNumber, event.trackingNumber);
    }
}
```
