```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class LegacyOrderNoteRecorded {
    @field(String) readonly note: string;

    constructor(note: string) {
        this.note = note;
    }
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
