```typescript
import { eventType, IEventLog } from '@cratis/chronicle';

@eventType()
class LegacyOrderNoteRecorded {
    constructor(readonly note: string) {}
}

async function appendToExistingOrder(log: IEventLog, orderId: string, note: string) {
    return log.append(orderId, new LegacyOrderNoteRecorded(note), {
        sourceType: 'Default',
        streamType: 'Default',
        streamId: orderId
    });
}

async function appendToExistingOrders(log: IEventLog, orderIds: string[], note: string) {
    return log.appendMany(orderIds.map(orderId => ({
        eventSourceId: orderId,
        event: new LegacyOrderNoteRecorded(note),
        eventSourceType: 'Default',
        eventStreamType: 'Default',
        eventStreamId: orderId
    })));
}
```
