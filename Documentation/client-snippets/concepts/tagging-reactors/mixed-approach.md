```typescript
import { EventContext, eventType, onceOnly, reactor, tag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TaggingReactorsOrderShipped {
    @field(String) readonly phoneNumber: string;
    @field(String) readonly trackingNumber: string;

    constructor(phoneNumber: string, trackingNumber: string) {
        this.phoneNumber = phoneNumber;
        this.trackingNumber = trackingNumber;
    }
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
